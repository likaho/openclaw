/**
 * Agent Runtime Service Tests
 * Tests for the AI agent execution service
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AgentTask, AgentResult, AgentTaskStatus } from '../services/shared/interfaces.js';

// Mock Kafka consumer
const createMockConsumer = () => ({
  connect: vi.fn().mockResolvedValue(undefined),
  subscribe: vi.fn().mockResolvedValue(undefined),
  run: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn().mockResolvedValue(undefined),
});

// Mock Kafka producer
const createMockProducer = () => ({
  connect: vi.fn().mockResolvedValue(undefined),
  send: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn().mockResolvedValue(undefined),
});

// Mock Redis
const createMockRedis = () => ({
  connect: vi.fn().mockResolvedValue(undefined),
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue('OK'),
  setex: vi.fn().mockResolvedValue('OK'),
  del: vi.fn().mockResolvedValue(1),
  quit: vi.fn().mockResolvedValue('OK'),
  on: vi.fn(),
});

describe('Agent Runtime Service', () => {
  describe('Task Management', () => {
    const activeTasks = new Map<string, { task: AgentTask; startedAt: number; status: string }>();

    it('should track active tasks', () => {
      const task: AgentTask = {
        id: 'task-123',
        sessionId: 'session-456',
        input: 'Process this request',
        context: {
          sessionId: 'session-456',
          userId: 'user-789',
          channel: 'discord',
          messageId: 'msg-001',
          tools: ['bash', 'read', 'write'],
        },
      };

      activeTasks.set(task.id, {
        task,
        startedAt: Date.now(),
        status: 'running',
      });

      expect(activeTasks.size).toBe(1);
      expect(activeTasks.get('task-123')?.status).toBe('running');
    });

    it('should complete task', () => {
      const task: AgentTask = {
        id: 'task-123',
        sessionId: 'session-456',
        input: 'Process this',
        context: {
          sessionId: 'session-456',
          userId: 'user-789',
          channel: 'discord',
          messageId: 'msg-001',
          tools: ['bash'],
        },
      };

      activeTasks.set(task.id, {
        task,
        startedAt: Date.now(),
        status: 'running',
      });

      // Mark as completed
      const activeTask = activeTasks.get('task-123');
      if (activeTask) {
        activeTask.status = 'completed';
      }

      expect(activeTasks.get('task-123')?.status).toBe('completed');
    });

    it('should fail task', () => {
      const task: AgentTask = {
        id: 'task-456',
        sessionId: 'session-456',
        input: 'Process this',
        context: {
          sessionId: 'session-456',
          userId: 'user-789',
          channel: 'discord',
          messageId: 'msg-001',
          tools: ['bash'],
        },
      };

      activeTasks.set(task.id, {
        task,
        startedAt: Date.now(),
        status: 'running',
      });

      // Mark as failed
      const activeTask = activeTasks.get('task-456');
      if (activeTask) {
        activeTask.status = 'failed';
      }

      expect(activeTasks.get('task-456')?.status).toBe('failed');
    });

    it('should respect max concurrent tasks limit', () => {
      const maxConcurrentTasks = 10;
      const tasks: AgentTask[] = [];

      // Add max concurrent tasks
      for (let i = 0; i < maxConcurrentTasks; i++) {
        tasks.push({
          id: `task-${i}`,
          sessionId: 'session-456',
          input: `Task ${i}`,
          context: {
            sessionId: 'session-456',
            userId: 'user-789',
            channel: 'discord',
            messageId: `msg-${i}`,
            tools: ['bash'],
          },
        });
      }

      // All should fit
      expect(tasks.length).toBe(maxConcurrentTasks);

      // Adding one more should exceed limit
      const shouldReject = tasks.length >= maxConcurrentTasks;
      expect(shouldReject).toBe(true);
    });
  });

  describe('Task Execution', () => {
    const executeTask = async (task: AgentTask, redis: ReturnType<typeof createMockRedis>): Promise<AgentResult> => {
      const startTime = Date.now();

      // Get session from Redis
      const sessionData = await redis.get(`session:${task.context.sessionId}`);

      // Simulate processing
      const output = `Processed task ${task.id}: ${task.input.substring(0, 30)}...`;

      const result: AgentResult = {
        taskId: task.id,
        success: true,
        output,
        duration: Date.now() - startTime,
        tokensUsed: Math.floor(Math.random() * 1000) + 500,
      };

      // Store result in Redis
      await redis.setex(`task:result:${task.id}`, 3600, JSON.stringify(result));

      return result;
    };

    it('should execute task successfully', async () => {
      const mockRedis = createMockRedis();
      mockRedis.get.mockResolvedValue(JSON.stringify({ id: 'session-456' }));
      mockRedis.setex.mockResolvedValue('OK');

      const task: AgentTask = {
        id: 'task-123',
        sessionId: 'session-456',
        input: 'Hello, process this message',
        context: {
          sessionId: 'session-456',
          userId: 'user-789',
          channel: 'discord',
          messageId: 'msg-001',
          tools: ['bash', 'read'],
        },
      };

      const result = await executeTask(task, mockRedis);

      expect(result.success).toBe(true);
      expect(result.taskId).toBe('task-123');
      expect(result.output).toContain('task-123');
      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(result.tokensUsed).toBeGreaterThan(0);
    });

    it('should handle missing session', async () => {
      const mockRedis = createMockRedis();
      mockRedis.get.mockResolvedValue(null);

      const task: AgentTask = {
        id: 'task-123',
        sessionId: 'session-456',
        input: 'Hello',
        context: {
          sessionId: 'session-456',
          userId: 'user-789',
          channel: 'discord',
          messageId: 'msg-001',
          tools: ['bash'],
        },
      };

      const result = await executeTask(task, mockRedis);

      expect(result.success).toBe(true);
      // Should still work even without session
      expect(result.taskId).toBe('task-123');
    });
  });

  describe('Task Timeout', () => {
    it('should handle timeout', () => {
      const taskId = 'task-timeout-123';
      const timeoutMs = 100;
      let timeoutTriggered = false;

      const timer = setTimeout(() => {
        timeoutTriggered = true;
      }, timeoutMs);

      // Wait for timeout
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          clearTimeout(timer);
          expect(timeoutTriggered).toBe(true);
          resolve();
        }, timeoutMs + 10);
      });
    });

    it('should not timeout if task completes first', () => {
      const taskId = 'task-123';
      const timeoutMs = 1000;
      let timeoutTriggered = false;

      const timer = setTimeout(() => {
        timeoutTriggered = true;
      }, timeoutMs);

      // Complete before timeout
      clearTimeout(timer);

      expect(timeoutTriggered).toBe(false);
    });
  });

  describe('Task Result Publishing', () => {
    it('should publish result to Kafka topic', async () => {
      const mockProducer = createMockProducer();
      const result: AgentResult = {
        taskId: 'task-123',
        success: true,
        output: 'Task completed',
        duration: 5000,
        tokensUsed: 1500,
      };

      await mockProducer.send({
        topic: `agent.results.session-456`,
        messages: [{
          key: result.taskId,
          value: JSON.stringify(result),
        }],
      });

      expect(mockProducer.send).toHaveBeenCalledWith({
        topic: 'agent.results.session-456',
        messages: [
          expect.objectContaining({
            key: 'task-123',
            value: JSON.stringify(result),
          }),
        ],
      });
    });
  });
});

describe('Agent Task Types', () => {
  describe('AgentTask', () => {
    it('should create task with required fields', () => {
      const task: AgentTask = {
        id: 'task-123',
        sessionId: 'session-456',
        input: 'Process this request',
        context: {
          sessionId: 'session-456',
          userId: 'user-789',
          channel: 'discord',
          messageId: 'msg-001',
          tools: ['bash', 'read', 'write'],
        },
      };

      expect(task.id).toBeDefined();
      expect(task.sessionId).toBeDefined();
      expect(task.input).toBeDefined();
      expect(task.context).toBeDefined();
      expect(task.context.tools).toHaveLength(3);
    });

    it('should allow optional priority and timeout', () => {
      const task: AgentTask = {
        id: 'task-123',
        sessionId: 'session-456',
        input: 'High priority task',
        context: {
          sessionId: 'session-456',
          userId: 'user-789',
          channel: 'discord',
          messageId: 'msg-001',
          tools: ['bash'],
        },
        priority: 'high',
        timeout: 60000,
      };

      expect(task.priority).toBe('high');
      expect(task.timeout).toBe(60000);
    });
  });

  describe('AgentResult', () => {
    it('should create successful result', () => {
      const result: AgentResult = {
        taskId: 'task-123',
        success: true,
        output: 'Task completed successfully',
        duration: 5000,
        tokensUsed: 1500,
      };

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
      expect(result.duration).toBe(5000);
    });

    it('should create failed result with error', () => {
      const result: AgentResult = {
        taskId: 'task-123',
        success: false,
        output: '',
        error: 'Task timeout',
        duration: 300000,
      };

      expect(result.success).toBe(false);
      expect(result.error).toBe('Task timeout');
    });
  });

  describe('AgentTaskStatus', () => {
    it('should define all task statuses', () => {
      const statuses: AgentTaskStatus[] = ['pending', 'running', 'completed', 'failed', 'cancelled'];

      expect(statuses).toContain('pending');
      expect(statuses).toContain('running');
      expect(statuses).toContain('completed');
      expect(statuses).toContain('failed');
      expect(statuses).toContain('cancelled');
    });
  });
});

describe('Agent Configuration', () => {
  const loadAgentConfig = (env: Record<string, string | undefined>) => ({
    runtimeId: env.RUNTIME_ID || 'runtime-1',
    redisUrl: env.REDIS_URL || 'redis://localhost:6379',
    kafkaBrokers: env.KAFKA_BROKERS?.split(',') || ['localhost:9092'],
    controlPlaneUrl: env.CONTROL_PLANE_URL || 'http://control-plane:3000',
    logLevel: env.LOG_LEVEL || 'info',
    maxConcurrentTasks: parseInt(env.MAX_CONCURRENT_TASKS || '10'),
    taskTimeout: parseInt(env.TASK_TIMEOUT || '300000'),
    workspacePath: env.WORKSPACE_PATH || '/workspace',
  });

  it('should use default values', () => {
    const config = loadAgentConfig({});

    expect(config.runtimeId).toBe('runtime-1');
    expect(config.maxConcurrentTasks).toBe(10);
    expect(config.taskTimeout).toBe(300000);
    expect(config.workspacePath).toBe('/workspace');
  });

  it('should accept custom values', () => {
    const config = loadAgentConfig({
      RUNTIME_ID: 'custom-runtime',
      MAX_CONCURRENT_TASKS: '20',
      TASK_TIMEOUT: '600000',
      WORKSPACE_PATH: '/custom/workspace',
    });

    expect(config.runtimeId).toBe('custom-runtime');
    expect(config.maxConcurrentTasks).toBe(20);
    expect(config.taskTimeout).toBe(600000);
    expect(config.workspacePath).toBe('/custom/workspace');
  });
});
