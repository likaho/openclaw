/**
 * Agent Runtime Service
 * Standalone microservice for executing AI agent tasks
 */

import { Kafka, Consumer, Producer } from 'kafkajs';
import Redis from 'ioredis';
import { Logger } from 'pino';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { 
  AgentTask, 
  AgentResult, 
  AgentTaskStatus,
  TaskEvent 
} from '../../shared/interfaces.js';
import { 
  OpenClawEvents, 
  KAFKA_TOPICS,
  AgentStartedEvent,
  AgentCompletedEvent,
  AgentFailedEvent 
} from '../../shared/events.js';

const AgentRuntimeConfigSchema = z.object({
  runtimeId: z.string().default('runtime-1'),
  redisUrl: z.string().url().default('redis://localhost:6379'),
  kafkaBrokers: z.array(z.string()).default(['localhost:9092']),
  controlPlaneUrl: z.string().url().default('http://control-plane:3000'),
  logLevel: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
  maxConcurrentTasks: z.number().default(10),
  taskTimeout: z.number().default(300000), // 5 minutes
  workspacePath: z.string().default('/workspace'),
});

type AgentRuntimeConfig = z.infer<typeof AgentRuntimeConfigSchema>;

interface ActiveTask {
  task: AgentTask;
  startedAt: number;
  status: 'running' | 'completed' | 'failed';
  result?: AgentResult;
}

class AgentRuntimeService {
  private config: AgentRuntimeConfig;
  private logger: Logger;
  private kafka: Kafka;
  private consumer: Consumer;
  private producer: Producer;
  private redis: Redis;
  private activeTasks: Map<string, ActiveTask> = new Map();
  private runtimeId: string;
  private isShuttingDown = false;

  constructor() {
    this.config = this.loadConfig();
    this.logger = this.createLogger();
    this.kafka = this.createKafka();
    this.runtimeId = `${this.config.runtimeId}-${process.env.POD_NAME || process.env.HOSTNAME || 'local'}`;
  }

  private loadConfig(): AgentRuntimeConfig {
    const env = {
      runtimeId: process.env.RUNTIME_ID || 'runtime-1',
      redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
      kafkaBrokers: process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'],
      controlPlaneUrl: process.env.CONTROL_PLANE_URL || 'http://control-plane:3000',
      logLevel: process.env.LOG_LEVEL as AgentRuntimeConfig['logLevel'] || 'info',
      maxConcurrentTasks: parseInt(process.env.MAX_CONCURRENT_TASKS || '10'),
      taskTimeout: parseInt(process.env.TASK_TIMEOUT || '300000'),
      workspacePath: process.env.WORKSPACE_PATH || '/workspace',
    };

    const parsed = AgentRuntimeConfigSchema.safeParse(env);
    if (!parsed.success) {
      throw new Error(`Invalid agent-runtime config: ${parsed.error.errors}`);
    }

    return parsed.data;
  }

  private createLogger(): Logger {
    return require('pino')({
      level: this.config.logLevel,
      name: 'agent-runtime',
      formatters: { bindings: () => ({ runtimeId: this.runtimeId }) },
    });
  }

  private createKafka(): Kafka {
    return new Kafka({
      clientId: this.runtimeId,
      brokers: this.config.kafkaBrokers,
      retry: { initialRetryTime: 100, retries: 8 },
    });
  }

  private createRedis(): Redis {
    return new Redis(this.config.redisUrl, { maxRetriesPerRequest: 3, lazyConnect: true });
  }

  async start(): Promise<void> {
    this.logger.info({ runtimeId: this.runtimeId }, 'Starting Agent Runtime service');

    // Initialize Kafka
    this.consumer = this.kafka.consumer({ 
      groupId: `agent-runtime-${this.config.runtimeId}`,
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
    });
    
    this.producer = this.kafka.producer();

    await this.consumer.connect();
    await this.producer.connect();
    this.logger.info('Kafka connected');

    // Initialize Redis
    this.redis = this.createRedis();
    await this.redis.connect();
    this.logger.info('Redis connected');

    // Subscribe to task topics
    await this.consumer.subscribe({ 
      topic: 'agent.tasks', 
      fromBeginning: false 
    });
    
    await this.consumer.subscribe({
      topic: KAFKA_TOPICS.AGENT_STARTED,
      fromBeginning: false,
    });

    // Start consuming
    await this.consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        if (!message.value) return;
        
        const event = JSON.parse(message.value.toString());
        
        if (topic === 'agent.tasks') {
          await this.handleTask(event as AgentTask);
        }
      },
    });

    // Publish runtime status
    await this.publishRuntimeStatus(true);

    this.logger.info({ runtimeId: this.runtimeId }, 'Agent Runtime service started');
  }

  private async handleTask(task: AgentTask): Promise<void> {
    // Check concurrent task limit
    if (this.activeTasks.size >= this.config.maxConcurrentTasks) {
      this.logger.warn({ taskId: task.id, activeTasks: this.activeTasks.size }, 'At max concurrent tasks, rejecting task');
      return;
    }

    // Check for timeout
    if (task.timeout && task.timeout > 0) {
      const timeoutMs = task.timeout;
      setTimeout(() => {
        if (this.activeTasks.has(task.id)) {
          this.handleTaskTimeout(task.id);
        }
      }, timeoutMs).unref();
    }

    // Track active task
    this.activeTasks.set(task.id, {
      task,
      startedAt: Date.now(),
      status: 'running',
    });

    // Publish agent.started event
    await this.publishEvent(
      OpenClawEvents.createAgentStarted(
        {
          taskId: task.id,
          sessionId: task.sessionId,
          input: task.input,
          context: task.context,
          startedAt: Date.now(),
        },
        this.runtimeId
      ),
      KAFKA_TOPICS.AGENT_STARTED
    );

    this.logger.info({ taskId: task.id, sessionId: task.sessionId }, 'Processing agent task');

    try {
      // Execute the agent task
      const result = await this.executeTask(task);

      // Update task status
      const activeTask = this.activeTasks.get(task.id);
      if (activeTask) {
        activeTask.status = 'completed';
        activeTask.result = result;
      }

      // Publish agent.completed event
      await this.publishEvent(
        OpenClawEvents.createAgentCompleted(
          {
            taskId: task.id,
            success: true,
            output: result.output,
            duration: result.duration,
            tokensUsed: result.tokensUsed,
            completedAt: Date.now(),
            duration: result.duration,
          },
          this.runtimeId
        ),
        KAFKA_TOPICS.AGENT_COMPLETED
      );

      // Send result back via Kafka
      await this.producer.send({
        topic: `agent.results.${task.sessionId}`,
        messages: [{
          key: task.id,
          value: JSON.stringify(result),
        }],
      });

      this.logger.info({ taskId: task.id, duration: result.duration }, 'Agent task completed');

    } catch (error) {
      // Update task status
      const activeTask = this.activeTasks.get(task.id);
      if (activeTask) {
        activeTask.status = 'failed';
      }

      // Publish agent.failed event
      await this.publishEvent(
        OpenClawEvents.createAgentFailed(
          {
            taskId: task.id,
            sessionId: task.sessionId,
            error: error instanceof Error ? error.message : 'Unknown error',
            failedAt: Date.now(),
            retryable: true,
          },
          this.runtimeId
        ),
        KAFKA_TOPICS.AGENT_FAILED
      );

      this.logger.error({ taskId: task.id, error }, 'Agent task failed');
    } finally {
      this.activeTasks.delete(task.id);
    }
  }

  private async executeTask(task: AgentTask): Promise<AgentResult> {
    const startTime = Date.now();
    
    // Get session context from Redis
    const sessionData = await this.redis.get(`session:${task.context.sessionId}`);
    const session = sessionData ? JSON.parse(sessionData) : {};

    // This is a simplified implementation
    // In production, this would call the actual LLM and execute tools
    const mockOutput = `[Agent: ${this.runtimeId}] Processed task ${task.id}: ${task.input.substring(0, 50)}...`;

    // Store result in Redis for later retrieval
    const result: AgentResult = {
      taskId: task.id,
      success: true,
      output: mockOutput,
      duration: Date.now() - startTime,
      tokensUsed: Math.floor(Math.random() * 1000) + 500,
    };

    // Cache result
    await this.redis.setex(
      `task:result:${task.id}`,
      3600, // 1 hour TTL
      JSON.stringify(result)
    );

    return result;
  }

  private handleTaskTimeout(taskId: string): void {
    const activeTask = this.activeTasks.get(taskId);
    if (!activeTask || activeTask.status !== 'running') return;

    activeTask.status = 'failed';
    
    this.logger.warn({ taskId }, 'Task timed out');

    // Publish timeout event
    this.publishEvent(
      OpenClawEvents.createAgentFailed(
        {
          taskId,
          sessionId: activeTask.task.sessionId,
          error: 'Task timeout',
          failedAt: Date.now(),
          retryable: true,
        },
        this.runtimeId
      ),
      KAFKA_TOPICS.AGENT_FAILED
    );

    this.activeTasks.delete(taskId);
  }

  private async publishEvent(event: unknown, topic: string): Promise<void> {
    await this.producer.send({
      topic,
      messages: [{
        key: (event as { payload: { taskId?: string } }).payload?.taskId || this.runtimeId,
        value: JSON.stringify(event),
      }],
    });
  }

  private async publishRuntimeStatus(connected: boolean): Promise<void> {
    // Publish health status
    await this.producer.send({
      topic: KAFKA_TOPICS.SYSTEM_HEALTH,
      messages: [{
        key: this.runtimeId,
        value: JSON.stringify({
          eventId: `health-${Date.now()}`,
          eventType: 'system.health',
          category: 'system',
          timestamp: Date.now(),
          source: this.runtimeId,
          version: '1.0.0',
          payload: {
            service: 'agent-runtime',
            status: connected ? 'healthy' : 'unhealthy',
            checks: [
              { name: 'kafka', status: 'pass', timestamp: Date.now() },
              { name: 'redis', status: 'pass', timestamp: Date.now() },
            ],
            uptime: process.uptime(),
            timestamp: Date.now(),
          },
        }),
      }],
    });
  }

  async stop(): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    this.logger.info({ runtimeId: this.runtimeId }, 'Stopping Agent Runtime service');

    await this.publishRuntimeStatus(false);

    // Wait for active tasks to complete (with timeout)
    const timeout = setTimeout(() => {
      this.logger.warn({ runtimeId: this.runtimeId }, 'Force stopping with active tasks');
    }, 30000);

    while (this.activeTasks.size > 0) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    clearTimeout(timeout);

    await this.consumer?.disconnect();
    await this.producer?.disconnect();
    await this.redis?.quit();

    this.logger.info({ runtimeId: this.runtimeId }, 'Agent Runtime service stopped');
  }

  async healthCheck() {
    const activeTasks = this.activeTasks.size;
    
    return {
      status: activeTasks >= this.config.maxConcurrentTasks ? 'degraded' : 'healthy',
      runtimeId: this.runtimeId,
      activeTasks,
      maxConcurrentTasks: this.config.maxConcurrentTasks,
      uptime: process.uptime(),
    };
  }
}

async function main(): Promise<void> {
  const service = new AgentRuntimeService();

  process.on('SIGTERM', async () => { await service.stop(); process.exit(0); });
  process.on('SIGINT', async () => { await service.stop(); process.exit(0); });

  await service.start();
}

main().catch((err) => {
  console.error('Failed to start Agent Runtime service:', err);
  process.exit(1);
});
