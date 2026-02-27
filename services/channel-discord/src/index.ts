/**
 * Discord Channel Service
 * Standalone microservice for handling Discord messaging
 */

import { Client, GatewayIntentBits, Events, REST, Routes, GatewayDispatchEvents } from 'discord.js';
import { Kafka } from 'kafkajs';
import Redis from 'ioredis';
import { Logger } from 'pino';

import { loadConfig } from './config.js';
import { MessageHandler } from './handler.js';
import type { DiscordMessage, DiscordChannelStatus } from './types.js';
import { Events as OpenClawEvents, ChannelConnectedEvent, ChannelDisconnectedEvent } from '../../shared/events.js';

const INSTANCE_ID = `discord-${process.env.POD_NAME || process.env.HOSTNAME || 'local'}-${Date.now()}`;

class DiscordChannelService {
  private client: Client;
  private config: ReturnType<typeof loadConfig>;
  private logger: Logger;
  private kafka: Kafka;
  private redis: Redis;
  private messageHandler: MessageHandler;
  private isShuttingDown = false;

  constructor() {
    this.config = loadConfig();
    this.logger = this.createLogger();
    this.kafka = this.createKafka();
    this.redis = this.createRedis();
    this.client = this.createClient();
    this.messageHandler = new MessageHandler(this.kafka, this.config.messageQueue, this.logger);
  }

  private createLogger(): Logger {
    return require('pino')({
      level: this.config.logLevel,
      name: 'discord-channel',
      formatters: {
        bindings: () => ({ instanceId: INSTANCE_ID }),
      },
    });
  }

  private createKafka(): Kafka {
    return new Kafka({
      clientId: INSTANCE_ID,
      brokers: this.config.kafkaBrokers,
      retry: {
        initialRetryTime: 100,
        retries: 8,
      },
    });
  }

  private createRedis(): Redis {
    return new Redis(this.config.redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
  }

  private createClient(): Client {
    const client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildMembers,
      ],
      partials: ['MESSAGE', 'CHANNEL', 'USER'],
    });

    client.on(Events.Debug, (msg) => this.logger.debug(msg));
    client.on(Events.Warn, (msg) => this.logger.warn(msg));
    client.on(Events.Error, (err) => this.logger.error({ err }, 'Discord client error'));

    return client;
  }

  async start(): Promise<void> {
    this.logger.info({ instanceId: INSTANCE_ID }, 'Starting Discord channel service');

    // Connect to Redis
    await this.redis.connect();
    this.logger.info('Connected to Redis');

    // Connect Kafka producer
    await this.messageHandler.connect();

    // Connect Discord client
    await this.client.login(this.config.botToken);
    this.logger.info('Logged in to Discord');

    // Register event handlers
    this.registerHandlers();

    // Announce connection status
    await this.publishConnectionStatus(true);

    this.logger.info({ instanceId: INSTANCE_ID }, 'Discord channel service started');
  }

  private registerHandlers(): void {
    // Message handler
    this.client.on(Events.MessageCreate, async (message) => {
      // Ignore bots (except optionally configured bot)
      if (message.author.bot && !process.env.ALLOW_BOT_MESSAGES) return;
      
      // Ignore empty messages
      if (!message.content && message.attachments.size === 0) return;

      const discordMsg: DiscordMessage = {
        id: message.id,
        channelId: message.channelId,
        guildId: message.guildId || undefined,
        author: {
          id: message.author.id,
          username: message.author.username,
          discriminator: message.author.discriminator,
          bot: message.author.bot,
        },
        content: message.content,
        timestamp: message.createdAt.toISOString(),
        attachments: message.attachments.map((a) => ({
          id: a.id,
          filename: a.name || 'unknown',
          url: a.url,
          contentType: a.contentType || 'application/octet-stream',
          size: a.size,
        })),
        embeds: message.embeds,
        mentions: {
          users: message.mentions.users.map((u) => ({ id: u.id, username: u.username })),
          channels: message.mentions.channels.map((c) => ({ id: c.id, name: c.name })),
          roles: message.mentions.roles.map((r) => ({ id: r.id, name: r.name })),
        },
      };

      await this.messageHandler.handle(discordMsg, INSTANCE_ID);
    });

    // Ready handler
    this.client.on(Events.ClientReady, () => {
      this.logger.info(
        { 
          instanceId: INSTANCE_ID,
          user: this.client.user?.tag,
          guilds: this.client.guilds.cache.size,
        },
        'Discord client ready'
      );
    });
  }

  private async publishConnectionStatus(connected: boolean): Promise<void> {
    const status: DiscordChannelStatus = {
      connected,
      channel: 'discord',
      lastHeartbeat: Date.now(),
      messageCount: 0,
      errorCount: 0,
      instanceId: INSTANCE_ID,
      guilds: this.client.guilds.cache.size > 0 
        ? this.client.guilds.cache.map((g) => g.id)
        : undefined,
    };

    const producer = this.kafka.producer();
    await producer.connect();

    const event = connected
      ? OpenClawEvents.createChannelConnected({ ...status, connectedAt: Date.now() }, INSTANCE_ID)
      : OpenClawEvents.createChannelDisconnected(
          {
            channel: 'discord',
            instanceId: INSTANCE_ID,
            disconnectedAt: Date.now(),
            reason: 'service_stop',
            lastHeartbeat: Date.now(),
          },
          INSTANCE_ID
        );

    await producer.send({
      topic: connected ? 'channel.connected' : 'channel.disconnected',
      messages: [
        {
          key: INSTANCE_ID,
          value: JSON.stringify(event),
        },
      ],
    });

    await producer.disconnect();
  }

  async stop(): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    this.logger.info({ instanceId: INSTANCE_ID }, 'Stopping Discord channel service');

    await this.publishConnectionStatus(false);

    this.client.destroy();
    await this.messageHandler.disconnect();
    await this.redis.quit();

    this.logger.info({ instanceId: INSTANCE_ID }, 'Discord channel service stopped');
  }

  async healthCheck(): Promise<{ status: string; instanceId: string; connected: boolean }> {
    return {
      status: this.client.isReady() ? 'healthy' : 'degraded',
      instanceId: INSTANCE_ID,
      connected: this.client.isReady(),
    };
  }
}

// Main entry point
async function main(): Promise<void> {
  const service = new DiscordChannelService();

  // Handle graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    service.logger.info({ signal }, 'Received shutdown signal');
    await service.stop();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Start service
  await service.start();

  // Health check endpoint
  const server = Bun.serve({
    port: 3000,
    async fetch(req) {
      const url = new URL(req.url);
      
      if (url.pathname === '/health') {
        const health = await service.healthCheck();
        return new Response(JSON.stringify(health), {
          status: health.connected ? 200 : 503,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      if (url.pathname === '/ready') {
        const health = await service.healthCheck();
        return new Response(null, { status: health.connected ? 200 : 503 });
      }

      return new Response('Not Found', { status: 404 });
    },
  });

  service.logger.info({ port: server.port }, 'Health check server started');
}

main().catch((err) => {
  console.error('Failed to start Discord channel service:', err);
  process.exit(1);
});
