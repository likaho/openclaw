/**
 * Telegram Channel Service
 * Standalone microservice for handling Telegram messaging
 */

import { Bot, GrammyError, HttpError } from 'grammy';
import { Kafka } from 'kafkajs';
import Redis from 'ioredis';
import { Logger } from 'pino';
import { z } from 'zod';
import { InboundMessage } from '@openclaw/shared/interfaces.js';
import { OpenClawEvents } from '@openclaw/shared/events.js';

const TelegramConfigSchema = z.object({
  botToken: z.string().min(1),
  messageQueue: z.string().default('telegram:inbound'),
  redisUrl: z.string().url().default('redis://localhost:6379'),
  kafkaBrokers: z.array(z.string()).default(['localhost:9092']),
  controlPlaneUrl: z.string().url().default('http://control-plane:3000'),
  logLevel: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
});

type TelegramConfig = z.infer<typeof TelegramConfigSchema>;

const INSTANCE_ID = `telegram-${process.env.POD_NAME || process.env.HOSTNAME || 'local'}-${Date.now()}`;

class TelegramChannelService {
  private bot: Bot;
  private config: TelegramConfig;
  private logger: Logger;
  private kafka: Kafka;
  private producer;
  private redis: Redis;
  private isShuttingDown = false;

  constructor() {
    this.config = this.loadConfig();
    this.logger = this.createLogger();
    this.kafka = this.createKafka();
    this.bot = this.createBot();
    this.redis = this.createRedis();
  }

  private loadConfig(): TelegramConfig {
    const env = {
      botToken: process.env.TELEGRAM_BOT_TOKEN,
      messageQueue: process.env.MESSAGE_QUEUE || 'telegram:inbound',
      redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
      kafkaBrokers: process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'],
      controlPlaneUrl: process.env.CONTROL_PLANE_URL || 'http://control-plane:3000',
      logLevel: process.env.LOG_LEVEL as TelegramConfig['logLevel'] || 'info',
    };

    const parsed = TelegramConfigSchema.safeParse({
      botToken: env.botToken,
      messageQueue: env.messageQueue,
      redisUrl: env.redisUrl,
      kafkaBrokers: env.kafkaBrokers,
      controlPlaneUrl: env.controlPlaneUrl,
      logLevel: env.logLevel,
    });

    if (!parsed.success) {
      throw new Error(`Invalid Telegram config: ${parsed.error.errors}`);
    }

    return parsed.data;
  }

  private createLogger(): Logger {
    return require('pino')({
      level: this.config.logLevel,
      name: 'telegram-channel',
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

  private createBot(): Bot {
    const bot = new Bot(this.config.botToken);

    bot.on('error', (err) => {
      if (err instanceof GrammyError) {
        this.logger.error({ error: err.error }, 'Grammy error');
      } else if (err instanceof HttpError) {
        this.logger.error({ error: err }, 'HTTP error');
      } else {
        this.logger.error({ err }, 'Unknown error');
      }
    });

    return bot;
  }

  private createRedis(): Redis {
    return new Redis(this.config.redisUrl, { maxRetriesPerRequest: 3, lazyConnect: true });
  }

  async start(): Promise<void> {
    this.logger.info({ instanceId: INSTANCE_ID }, 'Starting Telegram channel service');

    await this.redis.connect();
    this.logger.info('Connected to Redis');

    this.producer = this.kafka.producer();
    await this.producer.connect();
    this.logger.info('Kafka producer connected');

    this.registerHandlers();
    
    await this.bot.start();
    this.logger.info('Telegram bot started');

    await this.publishConnectionStatus(true);

    this.logger.info({ instanceId: INSTANCE_ID }, 'Telegram channel service started');
  }

  private registerHandlers(): void {
    this.bot.on('message:text', async (ctx) => {
      const message = ctx.message;
      
      const inbound: InboundMessage = {
        id: `telegram-${message.message_id}`,
        timestamp: message.date * 1000,
        channel: 'telegram',
        sender: String(message.from.id),
        content: message.text,
        metadata: {
          telegramChatId: String(message.chat.id),
          telegramMessageId: message.message_id,
          telegramFrom: {
            id: message.from.id,
            username: message.from.username,
            firstName: message.from.first_name,
            lastName: message.from.last_name,
            isBot: message.from.is_bot,
          },
          instanceId: INSTANCE_ID,
        },
      };

      await this.producer.send({
        topic: this.config.messageQueue,
        messages: [
          {
            key: inbound.sender,
            value: JSON.stringify(inbound),
            headers: { instanceId, channel: 'telegram', timestamp: String(inbound.timestamp) },
          },
        ],
      });

      this.logger.info({ messageId: inbound.id, sender: inbound.sender }, 'Published message to Kafka');
    });

    this.bot.on('message:photo', async (ctx) => {
      const message = ctx.message;
      const photo = message.photo[message.photo.length - 1];

      const inbound: InboundMessage = {
        id: `telegram-${message.message_id}`,
        timestamp: message.date * 1000,
        channel: 'telegram',
        sender: String(message.from.id),
        content: message.caption || '',
        metadata: {
          telegramChatId: String(message.chat.id),
          telegramMessageId: message.message_id,
          attachments: [
            {
              id: photo.file_id,
              type: 'image',
              url: `https://api.telegram.org/file/bot${this.config.botToken}/${photo.file_id}`,
              mimeType: 'image/jpeg',
            },
          ],
          instanceId: INSTANCE_ID,
        },
      };

      await this.producer.send({
        topic: this.config.messageQueue,
        messages: [{ key: inbound.sender, value: JSON.stringify(inbound) }],
      });
    });
  }

  private async publishConnectionStatus(connected: boolean): Promise<void> {
    const producer = this.kafka.producer();
    await producer.connect();

    const event = connected
      ? OpenClawEvents.createChannelConnected(
          {
            connected: true,
            channel: 'telegram',
            lastHeartbeat: Date.now(),
            messageCount: 0,
            errorCount: 0,
            instanceId: INSTANCE_ID,
            connectedAt: Date.now(),
          },
          INSTANCE_ID
        )
      : OpenClawEvents.createChannelDisconnected(
          { channel: 'telegram', instanceId: INSTANCE_ID, disconnectedAt: Date.now(), reason: 'service_stop', lastHeartbeat: Date.now() },
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

    this.logger.info({ instanceId: INSTANCE_ID }, 'Stopping Telegram channel service');
    await this.publishConnectionStatus(false);
    this.bot.stop();
    await this.producer?.disconnect();
    await this.redis.quit();
    this.logger.info({ instanceId: INSTANCE_ID }, 'Telegram channel service stopped');
  }

  async healthCheck() {
    return { status: 'healthy', instanceId: INSTANCE_ID, connected: true };
  }
}

async function main(): Promise<void> {
  const service = new TelegramChannelService();

  process.on('SIGTERM', async () => { await service.stop(); process.exit(0); });
  process.on('SIGINT', async () => { await service.stop(); process.exit(0); });

  await service.start();
}

main().catch((err) => {
  console.error('Failed to start Telegram channel service:', err);
  process.exit(1);
});
