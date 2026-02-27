/**
 * Slack Channel Service
 * Standalone microservice for handling Slack messaging
 */

import { App, LogLevel } from '@slack/bolt';
import { WebClient } from '@slack/web-api';
import { Kafka } from 'kafkajs';
import Redis from 'ioredis';
import { Logger } from 'pino';
import { z } from 'zod';
import { InboundMessage } from '../../shared/interfaces.js';
import { OpenClawEvents } from '../../shared/events.js';

const SlackConfigSchema = z.object({
  botToken: z.string().min(1),
  signingSecret: z.string().min(1),
  appToken: z.string().optional(),
  messageQueue: z.string().default('slack:inbound'),
  redisUrl: z.string().url().default('redis://localhost:6379'),
  kafkaBrokers: z.array(z.string()).default(['localhost:9092']),
  controlPlaneUrl: z.string().url().default('http://control-plane:3000'),
  logLevel: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
});

type SlackConfig = z.infer<typeof SlackConfigSchema>;

const INSTANCE_ID = `slack-${process.env.POD_NAME || process.env.HOSTNAME || 'local'}-${Date.now()}`;

class SlackChannelService {
  private app: App;
  private client: WebClient;
  private config: SlackConfig;
  private logger: Logger;
  private kafka: Kafka;
  private producer;
  private redis: Redis;
  private isShuttingDown = false;

  constructor() {
    this.config = this.loadConfig();
    this.logger = this.createLogger();
    this.kafka = this.createKafka();
    this.app = this.createApp();
    this.client = new WebClient(this.config.botToken);
    this.redis = this.createRedis();
  }

  private loadConfig(): SlackConfig {
    const env = {
      botToken: process.env.SLACK_BOT_TOKEN,
      signingSecret: process.env.SLACK_SIGNING_SECRET,
      appToken: process.env.SLACK_APP_TOKEN,
      messageQueue: process.env.MESSAGE_QUEUE || 'slack:inbound',
      redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
      kafkaBrokers: process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'],
      controlPlaneUrl: process.env.CONTROL_PLANE_URL || 'http://control-plane:3000',
      logLevel: process.env.LOG_LEVEL as SlackConfig['logLevel'] || 'info',
    };

    const parsed = SlackConfigSchema.safeParse({
      botToken: env.botToken,
      signingSecret: env.signingSecret,
      appToken: env.appToken,
      messageQueue: env.messageQueue,
      redisUrl: env.redisUrl,
      kafkaBrokers: env.kafkaBrokers,
      controlPlaneUrl: env.controlPlaneUrl,
      logLevel: env.logLevel,
    });

    if (!parsed.success) {
      throw new Error(`Invalid Slack config: ${parsed.error.errors}`);
    }

    return parsed.data;
  }

  private createLogger(): Logger {
    return require('pino')({
      level: this.config.logLevel,
      name: 'slack-channel',
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

  private createApp(): App {
    return new App({
      token: this.config.botToken,
      signingSecret: this.config.signingSecret,
      socketMode: !!this.config.appToken,
      appToken: this.config.appToken,
      logLevel: this.config.logLevel === 'debug' ? LogLevel.DEBUG : this.config.logLevel === 'info' ? LogLevel.INFO : LogLevel.ERROR,
    });
  }

  private createRedis(): Redis {
    return new Redis(this.config.redisUrl, { maxRetriesPerRequest: 3, lazyConnect: true });
  }

  async start(): Promise<void> {
    this.logger.info({ instanceId: INSTANCE_ID }, 'Starting Slack channel service');

    await this.redis.connect();
    this.logger.info('Connected to Redis');

    this.producer = this.kafka.producer();
    await this.producer.connect();
    this.logger.info('Kafka producer connected');

    this.registerHandlers();
    
    await this.app.start(3000);
    this.logger.info('Slack app started');

    await this.publishConnectionStatus(true);

    this.logger.info({ instanceId: INSTANCE_ID }, 'Slack channel service started');
  }

  private registerHandlers(): void {
    // Handle messages
    this.app.message(async ({ message, say }) => {
      if (!message.subtype || message.subtype === 'message_changed') {
        const msg = message as any;
        
        const inbound: InboundMessage = {
          id: `slack-${msg.ts}`,
          timestamp: Number(msg.ts) * 1000,
          channel: 'slack',
          sender: msg.user,
          content: msg.text,
          metadata: {
            slackChannelId: msg.channel,
            slackTs: msg.ts,
            slackThreadTs: msg.thread_ts,
            instanceId: INSTANCE_ID,
          },
        };

        await this.producer.send({
          topic: this.config.messageQueue,
          messages: [
            {
              key: inbound.sender,
              value: JSON.stringify(inbound),
              headers: { instanceId, channel: 'slack', timestamp: String(inbound.timestamp) },
            },
          ],
        });

        this.logger.info({ messageId: inbound.id, sender: inbound.sender }, 'Published message to Kafka');
      }
    });

    // Handle app mentions
    this.app.event('app_mention', async ({ event, say }) => {
      const inbound: InboundMessage = {
        id: `slack-${event.ts}`,
        timestamp: Number(event.ts) * 1000,
        channel: 'slack',
        sender: event.user,
        content: event.text,
        metadata: {
          slackChannelId: event.channel,
          slackTs: event.ts,
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
            channel: 'slack',
            lastHeartbeat: Date.now(),
            messageCount: 0,
            errorCount: 0,
            instanceId: INSTANCE_ID,
            connectedAt: Date.now(),
          },
          INSTANCE_ID
        )
      : OpenClawEvents.createChannelDisconnected(
          { channel: 'slack', instanceId: INSTANCE_ID, disconnectedAt: Date.now(), reason: 'service_stop', lastHeartbeat: Date.now() },
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

    this.logger.info({ instanceId: INSTANCE_ID }, 'Stopping Slack channel service');
    await this.publishConnectionStatus(false);
    await this.app.stop();
    await this.producer?.disconnect();
    await this.redis.quit();
    this.logger.info({ instanceId: INSTANCE_ID }, 'Slack channel service stopped');
  }

  async healthCheck() {
    return { status: 'healthy', instanceId: INSTANCE_ID, connected: true };
  }
}

async function main(): Promise<void> {
  const service = new SlackChannelService();

  process.on('SIGTERM', async () => { await service.stop(); process.exit(0); });
  process.on('SIGINT', async () => { await service.stop(); process.exit(0); });

  await service.start();
}

main().catch((err) => {
  console.error('Failed to start Slack channel service:', err);
  process.exit(1);
});
