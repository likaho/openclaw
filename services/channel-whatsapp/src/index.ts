/**
 * WhatsApp Channel Service
 * Standalone microservice for handling WhatsApp messaging
 */

import { create, Browser } from 'venom-bot';
import { Kafka } from 'kafkajs';
import Redis from 'ioredis';
import { Logger } from 'pino';
import { z } from 'zod';
import { InboundMessage } from '../../shared/interfaces.js';
import { OpenClawEvents } from '../../shared/events.js';

const WhatsAppConfigSchema = z.object({
  sessionName: z.string().default('openclaw'),
  messageQueue: z.string().default('whatsapp:inbound'),
  redisUrl: z.string().url().default('redis://localhost:6379'),
  kafkaBrokers: z.array(z.string()).default(['localhost:9092']),
  controlPlaneUrl: z.string().url().default('http://control-plane:3000'),
  logLevel: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
});

type WhatsAppConfig = z.infer<typeof WhatsAppConfigSchema>;

const INSTANCE_ID = `whatsapp-${process.env.POD_NAME || process.env.HOSTNAME || 'local'}-${Date.now()}`;

class WhatsAppChannelService {
  private browser: Browser | null = null;
  private config: WhatsAppConfig;
  private logger: Logger;
  private kafka: Kafka;
  private producer;
  private redis: Redis;
  private isShuttingDown = false;

  constructor() {
    this.config = this.loadConfig();
    this.logger = this.createLogger();
    this.kafka = this.createKafka();
    this.redis = this.createRedis();
  }

  private loadConfig(): WhatsAppConfig {
    const env = {
      sessionName: process.env.WHATSAPP_SESSION_NAME || 'openclaw',
      messageQueue: process.env.MESSAGE_QUEUE || 'whatsapp:inbound',
      redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
      kafkaBrokers: process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'],
      controlPlaneUrl: process.env.CONTROL_PLANE_URL || 'http://control-plane:3000',
      logLevel: process.env.LOG_LEVEL as WhatsAppConfig['logLevel'] || 'info',
    };

    const parsed = WhatsAppConfigSchema.safeParse({
      sessionName: env.sessionName,
      messageQueue: env.messageQueue,
      redisUrl: env.redisUrl,
      kafkaBrokers: env.kafkaBrokers,
      controlPlaneUrl: env.controlPlaneUrl,
      logLevel: env.logLevel,
    });

    if (!parsed.success) {
      throw new Error(`Invalid WhatsApp config: ${parsed.error.errors}`);
    }

    return parsed.data;
  }

  private createLogger(): Logger {
    return require('pino')({
      level: this.config.logLevel,
      name: 'whatsapp-channel',
      formatters: { bindings: () => ({ instanceId: INSTANCE_ID }) },
    });
  }

  private createKafka(): Kafka {
    return new Kafka({
      clientId: INSTANCE_ID,
      brokers: this.config.kafkaBrokers,
      retry: { initialRetryTime: 100, retries: 8 },
    });
  }

  private createRedis(): Redis {
    return new Redis(this.config.redisUrl, { maxRetriesPerRequest: 3, lazyConnect: true });
  }

  async start(): Promise<void> {
    this.logger.info({ instanceId: INSTANCE_ID }, 'Starting WhatsApp channel service');

    await this.redis.connect();
    this.logger.info('Connected to Redis');

    this.producer = this.kafka.producer();
    await this.producer.connect();
    this.logger.info('Kafka producer connected');

    // Initialize WhatsApp browser
    this.browser = await this.createBrowser();
    await this.startClient();

    await this.publishConnectionStatus(true);

    this.logger.info({ instanceId: INSTANCE_ID }, 'WhatsApp channel service started');
  }

  private async createBrowser(): Promise<Browser> {
    return await create(
      this.config.sessionName,
      (base64Qr) => {
        // QR Code callback - in production, send to UI
        this.logger.info('WhatsApp QR code received');
      },
      (session) => {
        // Session saved callback
        this.logger.info({ session }, 'WhatsApp session saved');
      },
      {
        headless: true,
        devtools: false,
        useChrome: false,
        printQRInTerminal: true,
      }
    );
  }

  private async startClient(): Promise<void> {
    if (!this.browser) throw new Error('Browser not initialized');

    this.browser.onMessage(async (message) => {
      // Ignore group messages unless configured
      if (message.isGroupMsg && !process.env.ALLOW_GROUP_MESSAGES) return;
      
      // Ignore events (like battery status)
      if (message.type === 'e2eNotification' || message.type === 'notification') return;

      const inbound: InboundMessage = {
        id: `whatsapp-${message.id}`,
        timestamp: message.timestamp * 1000,
        channel: 'whatsapp',
        sender: message.from,
        content: message.body,
        metadata: {
          whatsappFrom: message.from,
          whatsappId: message.id,
          whatsappType: message.type,
          instanceId: INSTANCE_ID,
        },
      };

      await this.producer.send({
        topic: this.config.messageQueue,
        messages: [
          {
            key: inbound.sender,
            value: JSON.stringify(inbound),
            headers: { instanceId, channel: 'whatsapp', timestamp: String(inbound.timestamp) },
          },
        ],
      });

      this.logger.info({ messageId: inbound.id, sender: inbound.sender }, 'Published message to Kafka');
    });

    this.logger.info('WhatsApp message handler registered');
  }

  async sendMessage(to: string, content: string): Promise<string> {
    if (!this.browser) throw new Error('Browser not initialized');

    const result = await this.browser.sendText(to, content);
    return result.id;
  }

  private async publishConnectionStatus(connected: boolean): Promise<void> {
    const producer = this.kafka.producer();
    await producer.connect();

    const event = connected
      ? OpenClawEvents.createChannelConnected(
          {
            connected: true,
            channel: 'whatsapp',
            lastHeartbeat: Date.now(),
            messageCount: 0,
            errorCount: 0,
            instanceId: INSTANCE_ID,
            connectedAt: Date.now(),
          },
          INSTANCE_ID
        )
      : OpenClawEvents.createChannelDisconnected(
          { channel: 'whatsapp', instanceId: INSTANCE_ID, disconnectedAt: Date.now(), reason: 'service_stop', lastHeartbeat: Date.now() },
          INSTANCE_ID
        );

    await producer.send({
      topic: connected ? 'channel.connected' : 'channel.disconnected',
      messages: [{ key: INSTANCE_ID, value: JSON.stringify(event) }],
    });

    await producer.disconnect();
  }

  async stop(): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    this.logger.info({ instanceId: INSTANCE_ID }, 'Stopping WhatsApp channel service');
    await this.publishConnectionStatus(false);

    if (this.browser) {
      await this.browser.close();
    }
    await this.producer?.disconnect();
    await this.redis.quit();
    this.logger.info({ instanceId: INSTANCE_ID }, 'WhatsApp channel service stopped');
  }

  async healthCheck() {
    return {
      status: this.browser ? 'healthy' : 'degraded',
      instanceId: INSTANCE_ID,
      connected: !!this.browser,
    };
  }
}

async function main(): Promise<void> {
  const service = new WhatsAppChannelService();

  process.on('SIGTERM', async () => { await service.stop(); process.exit(0); });
  process.on('SIGINT', async () => { await service.stop(); process.exit(0); });

  await service.start();
}

main().catch((err) => {
  console.error('Failed to start WhatsApp channel service:', err);
  process.exit(1);
});
