/**
 * Session Manager Service
 * Centralized session management using Redis
 */

import Redis from 'ioredis';
import { Kafka } from 'kafkajs';
import { Logger } from 'pino';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { Session } from '../../shared/interfaces.js';
import { OpenClawEvents, KAFKA_TOPICS } from '../../shared/events.js';

const SessionManagerConfigSchema = z.object({
  redisUrl: z.string().url().default('redis://localhost:6379'),
  redisClusterMode: z.boolean().default(false),
  sessionTtl: z.number().default(3600), // 1 hour
  kafkaBrokers: z.array(z.string()).default(['localhost:9092']),
  logLevel: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
});

type SessionManagerConfig = z.infer<typeof SessionManagerConfigSchema>;

class SessionManagerService {
  private config: SessionManagerConfig;
  private logger: Logger;
  private redis: Redis;
  private kafka: Kafka;
  private producer;
  private serviceId: string;
  private isShuttingDown = false;

  constructor() {
    this.config = this.loadConfig();
    this.logger = this.createLogger();
    this.kafka = this.createKafka();
    this.serviceId = `session-manager-${process.env.POD_NAME || process.env.HOSTNAME || 'local'}`;
  }

  private loadConfig(): SessionManagerConfig {
    const env = {
      redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
      redisClusterMode: process.env.REDIS_CLUSTER_MODE === 'true',
      sessionTtl: parseInt(process.env.SESSION_TTL || '3600'),
      kafkaBrokers: process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'],
      logLevel: process.env.LOG_LEVEL as SessionManagerConfig['logLevel'] || 'info',
    };

    const parsed = SessionManagerConfigSchema.safeParse(env);
    if (!parsed.success) {
      throw new Error(`Invalid session-manager config: ${parsed.error.errors}`);
    }

    return parsed.data;
  }

  private createLogger(): Logger {
    return require('pino')({
      level: this.config.logLevel,
      name: 'session-manager',
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
    this.logger.info({ serviceId: this.serviceId }, 'Starting Session Manager service');

    // Initialize Redis
    this.redis = new Redis(this.config.redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 50, 2000),
    });

    this.redis.on('error', (err) => {
      this.logger.error({ err }, 'Redis error');
    });

    await this.redis.connect();
    this.logger.info('Redis connected');

    // Initialize Kafka producer for events
    this.producer = this.kafka.producer();
    await this.producer.connect();
    this.logger.info('Kafka producer connected');

    // Subscribe to message events to create sessions
    const consumer = this.kafka.consumer({ groupId: 'session-manager' });
    await consumer.connect();
    await consumer.subscribe({ topic: 'message.inbound', fromBeginning: false });
    
    await consumer.run({
      eachMessage: async ({ message }) => {
        if (!message.value) return;
        const event = JSON.parse(message.value.toString());
        await this.handleMessageEvent(event);
      },
    });

    this.logger.info({ serviceId: this.serviceId }, 'Session Manager service started');
  }

  private async handleMessageEvent(event: { sender: string; channel: string }): Promise<void> {
    // Create or update session
    const sessionKey = `session:${event.channel}:${event.sender}`;
    const existing = await this.redis.get(sessionKey);

    if (!existing) {
      // Create new session
      const session: Session = {
        id: uuidv4(),
        userId: event.sender,
        channel: event.channel,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: {
          firstMessageAt: Date.now(),
          messageCount: 1,
        },
      };

      await this.redis.setex(sessionKey, this.config.sessionTtl, JSON.stringify(session));
      
      // Publish session.created event
      await this.publishSessionEvent('session.created', session);
      
      this.logger.info({ sessionId: session.id, channel: event.channel, userId: event.sender }, 'Created new session');
    } else {
      // Update existing session
      const session: Session = JSON.parse(existing);
      session.updatedAt = Date.now();
      (session.metadata as Record<string, unknown>).messageCount = ((session.metadata as Record<string, unknown>).messageCount as number || 0) + 1;
      
      await this.redis.setex(sessionKey, this.config.sessionTtl, JSON.stringify(session));
    }
  }

  async createSession(userId: string, channel: string, metadata?: Record<string, unknown>): Promise<Session> {
    const session: Session = {
      id: uuidv4(),
      userId,
      channel,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      metadata: {
        ...metadata,
        firstMessageAt: Date.now(),
        messageCount: 0,
      },
    };

    const sessionKey = `session:${channel}:${userId}`;
    await this.redis.setex(sessionKey, this.config.sessionTtl, JSON.stringify(session));

    // Publish session.created event
    await this.publishSessionEvent('session.created', session);

    this.logger.info({ sessionId: session.id, channel, userId }, 'Created session');
    return session;
  }

  async getSession(channel: string, userId: string): Promise<Session | null> {
    const sessionKey = `session:${channel}:${userId}`;
    const data = await this.redis.get(sessionKey);
    return data ? JSON.parse(data) : null;
  }

  async getSessionById(sessionId: string): Promise<Session | null> {
    // Search for session (in production, use a Redis index)
    const keys = await this.redis.keys(`session:*:${userId}*`);
    for (const key of keys) {
      const data = await this.redis.get(key);
      if (data) {
        const session = JSON.parse(data) as Session;
        if (session.id === sessionId) {
          return session;
        }
      }
    }
    return null;
  }

  async updateSession(channel: string, userId: string, updates: Partial<Session>): Promise<Session | null> {
    const sessionKey = `session:${channel}:${userId}`;
    const data = await this.redis.get(sessionKey);
    
    if (!data) return null;

    const session: Session = { ...JSON.parse(data), ...updates, updatedAt: Date.now() };
    await this.redis.setex(sessionKey, this.config.sessionTtl, JSON.stringify(session));

    return session;
  }

  async deleteSession(channel: string, userId: string): Promise<boolean> {
    const sessionKey = `session:${channel}:${userId}`;
    const result = await this.redis.del(sessionKey);
    return result > 0;
  }

  async endSession(channel: string, userId: string, reason?: string): Promise<void> {
    const sessionKey = `session:${channel}:${userId}`;
    const data = await this.redis.get(sessionKey);
    
    if (!data) return;

    const session: Session = JSON.parse(data);
    const endedAt = Date.now();
    const duration = endedAt - session.createdAt;

    // Publish session.ended event
    await this.publishSessionEvent('session.ended', {
      ...session,
      metadata: {
        ...session.metadata,
        endedAt,
        duration,
        reason,
      },
    });

    await this.redis.del(sessionKey);
    this.logger.info({ sessionId: session.id, channel, userId, duration }, 'Ended session');
  }

  async getActiveSessions(channel?: string): Promise<Session[]> {
    const pattern = channel ? `session:${channel}:*` : 'session:*';
    const keys = await this.redis.keys(pattern);
    
    const sessions: Session[] = [];
    for (const key of keys) {
      const data = await this.redis.get(key);
      if (data) {
        sessions.push(JSON.parse(data));
      }
    }
    
    return sessions;
  }

  async getSessionCount(channel?: string): Promise<number> {
    const pattern = channel ? `session:${channel}:*` : 'session:*';
    const keys = await this.redis.keys(pattern);
    return keys.length;
  }

  async refreshSession(channel: string, userId: string): Promise<boolean> {
    const sessionKey = `session:${channel}:${userId}`;
    const result = await this.redis.expire(sessionKey, this.config.sessionTtl);
    return result === 1;
  }

  private async publishSessionEvent(eventType: string, session: Session): Promise<void> {
    const topic = eventType === 'session.created' ? KAFKA_TOPICS.SESSION_CREATED : KAFKA_TOPICS.SESSION_ENDED;
    
    await this.producer.send({
      topic,
      messages: [{
        key: session.id,
        value: JSON.stringify(OpenClawEvents.createSessionCreated(session, this.serviceId)),
      }],
    });
  }

  async stop(): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    this.logger.info({ serviceId: this.serviceId }, 'Stopping Session Manager service');
    await this.producer?.disconnect();
    await this.redis.quit();
    this.logger.info({ serviceId: this.serviceId }, 'Session Manager service stopped');
  }

  async healthCheck() {
    const redisStatus = this.redis.status === 'ready' ? 'healthy' : 'unhealthy';
    const activeSessions = await this.getSessionCount();

    return {
      status: redisStatus === 'healthy' ? 'healthy' : 'degraded',
      serviceId: this.serviceId,
      redis: redisStatus,
      activeSessions,
      uptime: process.uptime(),
    };
  }
}

async function main(): Promise<void> {
  const service = new SessionManagerService();

  process.on('SIGTERM', async () => { await service.stop(); process.exit(0); });
  process.on('SIGINT', async () => { await service.stop(); process.exit(0); });

  await service.start();
}

main().catch((err) => {
  console.error('Failed to start Session Manager service:', err);
  process.exit(1);
});
