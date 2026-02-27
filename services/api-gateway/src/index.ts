/**
 * API Gateway Service
 * Main entry point for OpenClaw, routes requests to appropriate services
 */

import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { WebSocketServer, WebSocket } from 'ws';
import { Kafka, Producer, Consumer } from 'kafkajs';
import Redis from 'ioredis';
import { Logger } from 'pino';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

const ApiGatewayConfigSchema = z.object({
  port: z.number().default(18789),
  wsPort: z.number().default(18790),
  redisUrl: z.string().url().default('redis://localhost:6379'),
  kafkaBrokers: z.array(z.string()).default(['localhost:9092']),
  controlPlaneUrl: z.string().url().default('http://control-plane:3000'),
  sessionManagerUrl: z.string().url().default('http://session-manager:3000'),
  gatewayToken: z.string().min(1),
  logLevel: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
  rateLimitMax: z.number().default(100),
  rateLimitTimeWindow: z.number().default(60000),
});

type ApiGatewayConfig = z.infer<typeof ApiGatewayConfigSchema>;

interface AuthenticatedUser {
  userId: string;
  channel: string;
  sessionId?: string;
}

class ApiGatewayService {
  private config: ApiGatewayConfig;
  private logger: Logger;
  private fastify: FastifyInstance;
  private redis: Redis;
  private kafka: Kafka;
  private producer: Producer;
  private consumer: Consumer;
  private wsServer: WebSocketServer;
  private wsClients: Map<string, WebSocket> = new Map();
  private serviceId: string;
  private isShuttingDown = false;

  constructor() {
    this.config = this.loadConfig();
    this.logger = this.createLogger();
    this.fastify = this.createFastify();
    this.kafka = this.createKafka();
    this.serviceId = `api-gateway-${process.env.POD_NAME || process.env.HOSTNAME || 'local'}`;
  }

  private loadConfig(): ApiGatewayConfig {
    const env = {
      port: parseInt(process.env.PORT || '18789'),
      wsPort: parseInt(process.env.WS_PORT || '18790'),
      redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
      kafkaBrokers: process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'],
      controlPlaneUrl: process.env.CONTROL_PLANE_URL || 'http://control-plane:3000',
      sessionManagerUrl: process.env.SESSION_MANAGER_URL || 'http://session-manager:3000',
      gatewayToken: process.env.OPENCLAW_GATEWAY_TOKEN || 'dev-token',
      logLevel: process.env.LOG_LEVEL as ApiGatewayConfig['logLevel'] || 'info',
      rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100'),
      rateLimitTimeWindow: parseInt(process.env.RATE_LIMIT_TIME_WINDOW || '60000'),
    };

    const parsed = ApiGatewayConfigSchema.safeParse(env);
    if (!parsed.success) {
      throw new Error(`Invalid API Gateway config: ${parsed.error.errors}`);
    }

    return parsed.data;
  }

  private createLogger(): Logger {
    return require('pino')({
      level: this.config.logLevel,
      name: 'api-gateway',
      formatters: { bindings: () => ({ serviceId: this.serviceId }) },
    });
  }

  private createFastify(): FastifyInstance {
    const fastify = Fastify({
      logger: this.logger,
      genReqId: () => uuidv4(),
    });

    return fastify;
  }

  private createKafka(): Kafka {
    return new Kafka({
      clientId: this.serviceId,
      brokers: this.config.kafkaBrokers,
    });
  }

  async start(): Promise<void> {
    this.logger.info({ serviceId: this.serviceId }, 'Starting API Gateway service');

    // Initialize Redis
    this.redis = new Redis(this.config.redisUrl, { maxRetriesPerRequest: 3 });
    await this.redis.connect();
    this.logger.info('Redis connected');

    // Initialize Kafka
    this.producer = this.kafka.producer();
    this.consumer = this.kafka.consumer({ groupId: 'api-gateway' });
    
    await this.producer.connect();
    await this.consumer.connect();
    this.logger.info('Kafka connected');

    // Register plugins
    await this.fastify.register(cors, { 
      origin: true,
      credentials: true,
    });

    await this.fastify.register(rateLimit, {
      max: this.config.rateLimitMax,
      timeWindow: this.config.rateLimitTimeWindow,
    });

    // Register routes
    this.registerRoutes();

    // Start HTTP server
    await this.fastify.listen({ port: this.config.port, host: '0.0.0.0' });
    this.logger.info({ port: this.config.port }, 'HTTP server started');

    // Start WebSocket server
    this.startWebSocketServer();

    // Subscribe to message responses
    await this.subscribeToResponses();

    this.logger.info({ serviceId: this.serviceId }, 'API Gateway service started');
  }

  private registerRoutes(): void {
    // Health check
    this.fastify.get('/health', async () => {
      return {
        status: 'healthy',
        service: 'api-gateway',
        serviceId: this.serviceId,
        uptime: process.uptime(),
        timestamp: Date.now(),
      };
    });

    // Readiness check
    this.fastify.get('/ready', async () => {
      return { status: 'ready' };
    });

    // Metrics
    this.fastify.get('/metrics', async () => {
      return {
        service: 'api-gateway',
        connections: this.wsClients.size,
        uptime: process.uptime(),
      };
    });

    // WebSocket upgrade endpoint
    this.fastify.get('/ws', { websocket: true }, (socket, req) => {
      this.handleWebSocketConnection(socket, req);
    });

    // API routes
    this.fastify.post('/api/sessions', async (request) => {
      const { userId, channel } = request.body as { userId: string; channel: string };
      
      // Create session via session manager
      const response = await fetch(`${this.config.sessionManagerUrl}/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.gatewayToken}`,
        },
        body: JSON.stringify({ userId, channel }),
      });

      return response.json();
    });

    // Send message
    this.fastify.post('/api/messages', async (request) => {
      const { channel, userId, content, sessionId } = request.body as {
        channel: string;
        userId: string;
        content: string;
        sessionId?: string;
      };

      // Publish to message queue
      await this.producer.send({
        topic: 'message.inbound',
        messages: [{
          key: userId,
          value: JSON.stringify({
            id: uuidv4(),
            timestamp: Date.now(),
            channel,
            sender: userId,
            content,
            metadata: { sessionId, gatewayId: this.serviceId },
          }),
        }],
      });

      return { status: 'queued', messageId: uuidv4() };
    });

    // Channel status
    this.fastify.get('/api/channels/status', async () => {
      // Get channel status from Redis
      const channels = ['discord', 'telegram', 'slack', 'whatsapp'];
      const status: Record<string, { connected: boolean; instanceId?: string }> = {};
      
      for (const channel of channels) {
        const data = await this.redis.get(`channel:status:${channel}`);
        status[channel] = data ? JSON.parse(data) : { connected: false };
      }

      return status;
    });

    // Agent status
    this.fastify.get('/api/agents/status', async () => {
      const keys = await this.redis.keys('agent:runtime:*');
      const runtimes = [];
      
      for (const key of keys) {
        const data = await this.redis.get(key);
        if (data) runtimes.push(JSON.parse(data));
      }

      return { runtimes };
    });
  }

  private startWebSocketServer(): void {
    this.wsServer = new WebSocketServer({ port: this.config.wsPort });

    this.wsServer.on('connection', (ws, req) => {
      this.handleWebSocketConnection(ws, req);
    });

    this.wsServer.on('error', (err) => {
      this.logger.error({ err }, 'WebSocket server error');
    });

    this.logger.info({ wsPort: this.config.wsPort }, 'WebSocket server started');
  }

  private handleWebSocketConnection(socket: WebSocket, req: { url?: string }): void {
    const clientId = uuidv4();
    this.wsClients.set(clientId, socket);
    
    this.logger.info({ clientId }, 'WebSocket client connected');

    socket.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'auth') {
          // Authenticate via control plane
          this.handleWsAuth(clientId, socket, message);
        } else if (message.type === 'message') {
          this.handleWsMessage(clientId, message);
        }
      } catch (error) {
        this.logger.error({ clientId, error }, 'Error processing WebSocket message');
      }
    });

    socket.on('close', () => {
      this.wsClients.delete(clientId);
      this.logger.info({ clientId }, 'WebSocket client disconnected');
    });

    socket.on('error', (err) => {
      this.logger.error({ clientId, err }, 'WebSocket error');
    });

    // Send connection confirmation
    socket.send(JSON.stringify({ type: 'connected', clientId }));
  }

  private async handleWsAuth(clientId: string, socket: WebSocket, message: { token: string }): Promise<void> {
    // Validate token (simplified - in production, verify against control plane)
    if (message.token === this.config.gatewayToken) {
      socket.send(JSON.stringify({ type: 'auth_success', clientId }));
      this.logger.info({ clientId }, 'WebSocket client authenticated');
    } else {
      socket.send(JSON.stringify({ type: 'auth_failed', error: 'Invalid token' }));
      socket.close();
    }
  }

  private async handleWsMessage(clientId: string, message: { content: string; channel?: string }): Promise<void> {
    // Publish message to Kafka
    await this.producer.send({
      topic: 'message.inbound',
      messages: [{
        key: clientId,
        value: JSON.stringify({
          id: uuidv4(),
          timestamp: Date.now(),
          channel: message.channel || 'ws',
          sender: clientId,
          content: message.content,
          metadata: { gatewayId: this.serviceId, wsClientId: clientId },
        }),
      }],
    });
  }

  private async subscribeToResponses(): Promise<void> {
    await this.consumer.subscribe({ topic: 'agent.results.*', fromBeginning: false });
    
    await this.consumer.run({
      eachMessage: async ({ topic, message }) => {
        if (!message.value) return;
        
        const result = JSON.parse(message.value.toString());
        const sessionId = topic.replace('agent.results.', '');
        
        // Find WebSocket client for this session
        for (const [clientId, ws] of this.wsClients) {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'agent_response',
              sessionId,
              result,
            }));
          }
        }
      },
    });
  }

  async stop(): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    this.logger.info({ serviceId: this.serviceId }, 'Stopping API Gateway service');

    // Close WebSocket connections
    for (const [clientId, ws] of this.wsClients) {
      ws.close();
    }
    this.wsClients.clear();
    this.wsServer?.close();

    await this.fastify.close();
    await this.producer?.disconnect();
    await this.consumer?.disconnect();
    await this.redis.quit();

    this.logger.info({ serviceId: this.serviceId }, 'API Gateway service stopped');
  }
}

async function main(): Promise<void> {
  const service = new ApiGatewayService();

  process.on('SIGTERM', async () => { await service.stop(); process.exit(0); });
  process.on('SIGINT', async () => { await service.stop(); process.exit(0); });

  await service.start();
}

main().catch((err) => {
  console.error('Failed to start API Gateway service:', err);
  process.exit(1);
});
