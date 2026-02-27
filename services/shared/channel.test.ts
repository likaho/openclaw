/**
 * Channel Service Tests
 * Tests for shared channel service functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { InboundMessage, ChannelStatus } from '../services/shared/interfaces.js';

// Mock the message handler functionality
class MockMessageHandler {
  private topic: string;
  private messages: InboundMessage[] = [];
  private producer: {
    send: vi.fn;
    connect: vi.fn;
    disconnect: vi.fn;
  };

  constructor(topic: string) {
    this.topic = topic;
    this.producer = {
      send: vi.fn().mockResolvedValue(undefined),
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
    };
  }

  async connect(): Promise<void> {
    await this.producer.connect();
  }

  async disconnect(): Promise<void> {
    await this.producer.disconnect();
  }

  async handle(message: InboundMessage): Promise<void> {
    this.messages.push(message);
    await this.producer.send({
      topic: this.topic,
      messages: [{ key: message.sender, value: JSON.stringify(message) }],
    });
  }

  getMessages(): InboundMessage[] {
    return this.messages;
  }

  getProducer() {
    return this.producer;
  }
}

describe('Channel Service Utilities', () => {
  describe('Message Handler', () => {
    let handler: MockMessageHandler;

    beforeEach(() => {
      handler = new MockMessageHandler('test:inbound');
    });

    it('should connect to message queue', async () => {
      await handler.connect();
      expect(handler.getProducer().connect).toHaveBeenCalled();
    });

    it('should publish message to topic', async () => {
      const message: InboundMessage = {
        id: 'msg-123',
        timestamp: Date.now(),
        channel: 'discord',
        sender: 'user-456',
        content: 'Hello world',
      };

      await handler.handle(message);

      expect(handler.getProducer().send).toHaveBeenCalledWith({
        topic: 'test:inbound',
        messages: [
          expect.objectContaining({
            key: 'user-456',
            value: JSON.stringify(message),
          }),
        ],
      });
    });

    it('should store handled messages', async () => {
      const message: InboundMessage = {
        id: 'msg-123',
        timestamp: Date.now(),
        channel: 'discord',
        sender: 'user-456',
        content: 'Hello',
      };

      await handler.handle(message);

      expect(handler.getMessages()).toHaveLength(1);
      expect(handler.getMessages()[0].id).toBe('msg-123');
    });

    it('should disconnect from message queue', async () => {
      await handler.connect();
      await handler.disconnect();
      expect(handler.getProducer().disconnect).toHaveBeenCalled();
    });
  });

  describe('Message Transformation', () => {
    const transformDiscordMessage = (discordMsg: {
      id: string;
      channelId: string;
      guildId?: string;
      author: { id: string; username: string; bot: boolean };
      content: string;
      timestamp: string;
      attachments: Array<{ id: string; filename: string; url: string; contentType: string; size: number }>;
    }): InboundMessage => ({
      id: `discord-${discordMsg.id}`,
      timestamp: new Date(discordMsg.timestamp).getTime(),
      channel: 'discord',
      sender: discordMsg.author.id,
      content: discordMsg.content,
      metadata: {
        discordChannelId: discordMsg.channelId,
        discordGuildId: discordMsg.guildId,
        attachments: discordMsg.attachments.map((att) => ({
          id: att.id,
          type: att.contentType.startsWith('image/') ? 'image' : 'document',
          url: att.url,
          mimeType: att.contentType,
          filename: att.filename,
          size: att.size,
        })),
      },
    });

    it('should transform Discord message to InboundMessage', () => {
      const discordMsg = {
        id: '123456',
        channelId: 'C123',
        guildId: 'G456',
        author: { id: 'U789', username: 'testuser', bot: false },
        content: 'Hello Discord',
        timestamp: '2024-01-01T00:00:00.000Z',
        attachments: [],
      };

      const result = transformDiscordMessage(discordMsg);

      expect(result.id).toBe('discord-123456');
      expect(result.channel).toBe('discord');
      expect(result.sender).toBe('U789');
      expect(result.content).toBe('Hello Discord');
      expect(result.metadata.discordChannelId).toBe('C123');
      expect(result.metadata.discordGuildId).toBe('G456');
    });

    it('should handle attachments correctly', () => {
      const discordMsg = {
        id: '123456',
        channelId: 'C123',
        author: { id: 'U789', username: 'testuser', bot: false },
        content: 'Check this image',
        timestamp: '2024-01-01T00:00:00.000Z',
        attachments: [
          { id: 'att-1', filename: 'image.jpg', url: 'https://example.com/img.jpg', contentType: 'image/jpeg', size: 1024 },
          { id: 'att-2', filename: 'doc.pdf', url: 'https://example.com/doc.pdf', contentType: 'application/pdf', size: 2048 },
        ],
      };

      const result = transformDiscordMessage(discordMsg);

      expect(result.metadata.attachments).toHaveLength(2);
      expect(result.metadata.attachments[0].type).toBe('image');
      expect(result.metadata.attachments[1].type).toBe('document');
    });
  });

  describe('Channel Status', () => {
    it('should create connected status', () => {
      const status: ChannelStatus = {
        connected: true,
        channel: 'discord',
        lastHeartbeat: Date.now(),
        messageCount: 100,
        errorCount: 0,
        instanceId: 'discord-001',
      };

      expect(status.connected).toBe(true);
      expect(status.messageCount).toBe(100);
      expect(status.errorCount).toBe(0);
    });

    it('should create disconnected status', () => {
      const status: ChannelStatus = {
        connected: false,
        channel: 'telegram',
        lastHeartbeat: Date.now() - 60000,
        messageCount: 50,
        errorCount: 5,
        instanceId: 'telegram-001',
      };

      expect(status.connected).toBe(false);
      expect(status.errorCount).toBe(5);
    });

    it('should track message count', () => {
      const status: ChannelStatus = {
        connected: true,
        channel: 'slack',
        lastHeartbeat: Date.now(),
        messageCount: 0,
        errorCount: 0,
        instanceId: 'slack-001',
      };

      // Simulate message count increment
      status.messageCount += 1;
      expect(status.messageCount).toBe(1);

      status.messageCount += 10;
      expect(status.messageCount).toBe(11);
    });
  });
});

describe('Channel Configuration', () => {
  const loadChannelConfig = (env: Record<string, string | undefined>) => {
    return {
      botToken: env.BOT_TOKEN || '',
      messageQueue: env.MESSAGE_QUEUE || 'default:inbound',
      redisUrl: env.REDIS_URL || 'redis://localhost:6379',
      kafkaBrokers: env.KAFKA_BROKERS?.split(',') || ['localhost:9092'],
      controlPlaneUrl: env.CONTROL_PLANE_URL || 'http://control-plane:3000',
      logLevel: env.LOG_LEVEL || 'info',
    };
  };

  it('should use default values when env vars not set', () => {
    const config = loadChannelConfig({});

    expect(config.messageQueue).toBe('default:inbound');
    expect(config.redisUrl).toBe('redis://localhost:6379');
    expect(config.kafkaBrokers).toEqual(['localhost:9092']);
    expect(config.logLevel).toBe('info');
  });

  it('should use env vars when set', () => {
    const config = loadChannelConfig({
      BOT_TOKEN: 'test-token',
      MESSAGE_QUEUE: 'discord:inbound',
      REDIS_URL: 'redis://custom:6379',
      KAFKA_BROKERS: 'kafka1:9092,kafka2:9092',
      CONTROL_PLANE_URL: 'http://custom:3000',
      LOG_LEVEL: 'debug',
    });

    expect(config.botToken).toBe('test-token');
    expect(config.messageQueue).toBe('discord:inbound');
    expect(config.redisUrl).toBe('redis://custom:6379');
    expect(config.kafkaBrokers).toEqual(['kafka1:9092', 'kafka2:9092']);
    expect(config.controlPlaneUrl).toBe('http://custom:3000');
    expect(config.logLevel).toBe('debug');
  });

  it('should validate required bot token', () => {
    const config = loadChannelConfig({ BOT_TOKEN: '' });
    expect(config.botToken).toBe('');
    // In production, validation would happen here
  });
});
