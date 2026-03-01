/**
 * Control Plane Service (ACP Protocol)
 * Handles agent communication protocol and session coordination
 */

import { WebSocketServer, WebSocket } from 'ws';
import { Kafka, Producer } from 'kafkajs';
import Redis from 'ioredis';
import { Logger } from 'pino';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { AgentTask, Session } from '@openclaw/shared/interfaces.js';
import { OpenClawEvents, KAFKA_TOPICS } from '@openclaw/shared/events.js';

const ControlPlaneConfigSchema = z.object({
  port: z.number().default(3000),
  redisUrl: z.string().url().default('redis://localhost:6379'),
  kafkaBrokers: z.array(z.string()).default(['localhost:9092']),
  sessionManagerUrl: z.string().url().default('http://session-manager:3000'),
  agentRuntimeUrl: z.string().url().default('http://agent-runtime:3000'),
  gatewayToken: z.string().min(1),
  logLevel: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
  maxConnections: z.number().default(1000),
  messageTimeout: z.number().default(60000),
});

type ControlPlaneConfig = z.infer<typeof ControlPlaneConfigSchema>;

interface ConnectedClient {
  id: string;
  ws: WebSocket;
  sessionId?: string;
  userId?: string;
  channel?: string;
  authenticated: boolean;
}

class ControlPlaneService {
  private config: ControlPlaneConfig;
  private logger: Logger;
  private redis: Redis;
  private kafka: Kafka;
  private producer: Producer;
  private wss: WebSocketServer;
  private clients: Map<string, ConnectedClient> = new Map();
  private serviceId: string;
  private isShuttingDown = false;

  constructor() {
    this.config = this.loadConfig();
    this.logger = this.createLogger();
    this.kafka = this.createKafka();
    this.serviceId = `control-plane-${process.env.POD_NAME || process.env.HOSTNAME || 'local'}`;
  }

  private loadConfig(): ControlPlaneConfig {
    const env = {
      port: parseInt(process.env.PORT || '3000'),
      redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
      kafkaBrokers: process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'],
      sessionManagerUrl: process.env.SESSION_MANAGER_URL || 'http://session-manager:3000',
      agentRuntimeUrl: process.env.AGENT_RUNTIME_URL || 'http://agent-runtime:3000',
      gatewayToken: process.env.OPENCLAW_GATEWAY_TOKEN || 'dev-token',
      logLevel: process.env.LOG_LEVEL as ControlPlaneConfig['logLevel'] || 'info',
      maxConnections: parseInt(process.env.MAX_CONNECTIONS || '1000'),
      messageTimeout: parseInt(process.env.MESSAGE_TIMEOUT || '60000'),
    };

    const parsed = ControlPlaneConfigSchema.safeParse(env);
    if (!parsed.success) {
      throw new Error(`Invalid control-plane config: ${parsed.error.errors}`);
    }

    return parsed.data;
  }

  private createLogger(): Logger {
    return require('pino')({
      level: this.config.logLevel,
      name: 'control-plane',
      formatters: { bindings: () => ({ serviceId: this.serviceId }) },
    });
  }

  private createKafka(): Kafka {
    return new Kafka({
      clientId: this.serviceId,
      brokers: this.config.kafkaBrokers,
    });
  }

  async start(): Promise<void> {
    this.logger.info({ serviceId: this.serviceId }, 'Starting Control Plane service');

    // Initialize Redis
    this.redis = new Redis(this.config.redisUrl, { maxRetriesPerRequest: 3 });
    await this.redis.connect();
    this.logger.info('Redis connected');

    // Initialize Kafka
    this.producer = this.kafka.producer();
    await this.producer.connect();
    this.logger.info('Kafka producer connected');

    // Start WebSocket server
    this.wss = new WebSocketServer({ port: this.config.port });
    
    this.wss.on('connection', (ws, req) => this.handleConnection(ws, req));
    this.wss.on('error', (err) => this.logger.error({ err }, 'WebSocket server error'));

    this.logger.info({ port: this.config.port }, 'Control Plane service started');
  }

  private handleConnection(ws: WebSocket, req: { url?: string }): void {
    const clientId = uuidv4();
    const client: ConnectedClient = {
      id: clientId,
      ws,
      authenticated: false,
    };

    this.clients.set(clientId, client);
    this.logger.info({ clientId }, 'New client connected');

    ws.on('message', (data) => this.handleMessage(clientId, data));
    ws.on('close', () => this.handleDisconnect(clientId));
    ws.on('error', (err) => this.logger.error({ clientId, err }, 'Client error'));

    // Send welcome message
    this.sendToClient(clientId, {
      type: 'welcome',
      clientId,
      timestamp: Date.now(),
    });
  }

  private async handleMessage(clientId: string, data: Buffer): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      const message = JSON.parse(data.toString());
      this.logger.debug({ clientId, messageType: message.type }, 'Received message');

      switch (message.type) {
        case 'auth':
          await this.handleAuth(client, message);
          break;
        case 'session_start':
          await this.handleSessionStart(client, message);
          break;
        case 'message':
          await this.handleUserMessage(client, message);
          break;
        case 'session_end':
          await this.handleSessionEnd(client, message);
          break;
        case 'ping':
          this.sendToClient(clientId, { type: 'pong', timestamp: Date.now() });
          break;
        default:
          this.logger.warn({ clientId, messageType: message.type }, 'Unknown message type');
      }
    } catch (error) {
      this.logger.error({ clientId, error }, 'Error handling message');
      this.sendToClient(clientId, {
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async handleAuth(client: ConnectedClient, message: { token?: string }): Promise<void> {
    if (message.token === this.config.gatewayToken) {
      client.authenticated = true;
      this.sendToClient(client.id, {
        type: 'auth_success',
        timestamp: Date.now(),
      });
      this.logger.info({ clientId: client.id }, 'Client authenticated');
    } else {
      this.sendToClient(client.id, {
        type: 'auth_failed',
        error: 'Invalid token',
        timestamp: Date.now(),
      });
      this.logger.warn({ clientId: client.id }, 'Authentication failed');
    }
  }

  private async handleSessionStart(client: ConnectedClient, message: { channel?: string; userId?: string }): Promise<void> {
    if (!client.authenticated) {
      this.sendToClient(client.id, { type: 'error', error: 'Not authenticated' });
      return;
    }

    const sessionId = uuidv4();
    client.sessionId = sessionId;
    client.channel = message.channel;
    client.userId = message.userId;

    // Store session mapping in Redis
    await this.redis.setex(
      `client_session:${client.id}`,
      3600,
      JSON.stringify({ sessionId, channel: message.channel, userId: message.userId })
    );

    // Publish agent.started event
    await this.producer.send({
      topic: KAFKA_TOPICS.AGENT_STARTED,
      messages: [{
        key: sessionId,
        value: JSON.stringify(OpenClawEvents.createAgentStarted(
          {
            taskId: `session-${sessionId}`,
            sessionId,
            input: 'Session started',
            context: {
              sessionId,
              userId: message.userId || '',
              channel: message.channel || '',
              messageId: '',
              tools: [],
            },
            startedAt: Date.now(),
          },
          this.serviceId
        )),
      }],
    });

    this.sendToClient(client.id, {
      type: 'session_started',
      sessionId,
      timestamp: Date.now(),
    });

    this.logger.info({ clientId: client.id, sessionId, channel: message.channel }, 'Session started');
  }

  private async handleUserMessage(client: ConnectedClient, message: { content?: string }): Promise<void> {
    if (!client.authenticated || !client.sessionId) {
      this.sendToClient(client.id, { type: 'error', error: 'No active session' });
      return;
    }

    const taskId = uuidv4();
    const task: AgentTask = {
      id: taskId,
      sessionId: client.sessionId,
      input: message.content || '',
      context: {
        sessionId: client.sessionId,
        userId: client.userId || '',
        channel: client.channel || '',
        messageId: taskId,
        tools: ['bash', 'read', 'write'],
        model: 'claude-3-opus',
      },
      priority: 'normal',
      timeout: 300000,
    };

    // Submit task to Kafka
    await this.producer.send({
      topic: 'agent.tasks',
      messages: [{
        key: task.sessionId,
        value: JSON.stringify(task),
      }],
    });

    // Acknowledge message received
    this.sendToClient(client.id, {
      type: 'message_received',
      taskId,
      timestamp: Date.now(),
    });

    this.logger.info({ clientId: client.id, taskId, sessionId: client.sessionId }, 'Task submitted');
  }

  private async handleSessionEnd(client: ConnectedClient, message: unknown): Promise<void> {
    if (!client.sessionId) {
      this.sendToClient(client.id, { type: 'error', error: 'No active session' });
      return;
    }

    const sessionId = client.sessionId;

    // Publish session ended event
    await this.producer.send({
      topic: KAFKA_TOPICS.SESSION_ENDED,
      messages: [{
        key: sessionId,
        value: JSON.stringify({
          eventId: uuidv4(),
          eventType: 'session.ended',
          category: 'session',
          timestamp: Date.now(),
          source: this.serviceId,
          version: '1.0.0',
          payload: {
            sessionId,
            userId: client.userId || '',
            channel: client.channel || '',
            endedAt: Date.now(),
            duration: 0,
            reason: 'user_disconnected',
          },
        }),
      }],
    });

    // Cleanup Redis
    await this.redis.del(`client_session:${client.id}`);

    this.sendToClient(client.id, {
      type: 'session_ended',
      sessionId,
      timestamp: Date.now(),
    });

    this.logger.info({ clientId: client.id, sessionId }, 'Session ended');

    client.sessionId = undefined;
  }

  private handleDisconnect(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client?.sessionId) {
      this.handleSessionEnd(client, {}).catch((err) => 
        this.logger.error({ clientId, err }, 'Error ending session on disconnect')
      );
    }

    this.clients.delete(clientId);
    this.logger.info({ clientId }, 'Client disconnected');
  }

  private sendToClient(clientId: string, message: Record<string, unknown>): void {
    const client = this.clients.get(clientId);
    if (client?.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  }

  async stop(): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    this.logger.info({ serviceId: this.serviceId }, 'Stopping Control Plane service');

    // Close all client connections
    for (const [clientId, client] of this.clients) {
      client.ws.close();
    }
    this.clients.clear();

    this.wss.close();
    await this.producer?.disconnect();
    await this.redis.quit();

    this.logger.info({ serviceId: this.serviceId }, 'Control Plane service stopped');
  }

  async healthCheck() {
    return {
      status: 'healthy',
      serviceId: this.serviceId,
      connections: this.clients.size,
      authenticatedConnections: Array.from(this.clients.values()).filter(c => c.authenticated).length,
      uptime: process.uptime(),
    };
  }
}

async function main(): Promise<void> {
  const service = new ControlPlaneService();

  process.on('SIGTERM', async () => { await service.stop(); process.exit(0); });
  process.on('SIGINT', async () => { await service.stop(); process.exit(0); });

  await service.start();
}

main().catch((err) => {
  console.error('Failed to start Control Plane service:', err);
  process.exit(1);
});
