/**
 * Discord Message Handler
 * Transforms Discord messages to OpenClaw InboundMessage format
 */

import type { InboundMessage } from '../../shared/interfaces.js';
import type { DiscordMessage, DiscordMessageHandler } from './types.js';
import { Kafka } from 'kafkajs';
import { Logger } from 'pino';

export class MessageHandler {
  private kafka: Kafka;
  private producer;
  private logger: Logger;
  private topic: string;

  constructor(kafka: Kafka, topic: string, logger: Logger) {
    this.kafka = kafka;
    this.producer = kafka.producer();
    this.topic = topic;
    this.logger = logger;
  }

  async connect(): Promise<void> {
    await this.producer.connect();
    this.logger.info('Kafka producer connected');
  }

  async disconnect(): Promise<void> {
    await this.producer.disconnect();
    this.logger.info('Kafka producer disconnected');
  }

  /**
   * Transform Discord message to OpenClaw InboundMessage
   */
  transformToInbound(discordMsg: DiscordMessage, instanceId: string): InboundMessage {
    return {
      id: `discord-${discordMsg.id}`,
      timestamp: new Date(discordMsg.timestamp).getTime(),
      channel: 'discord',
      sender: discordMsg.author.id,
      content: discordMsg.content,
      metadata: {
        discordChannelId: discordMsg.channelId,
        discordGuildId: discordMsg.guildId,
        discordAuthor: {
          id: discordMsg.author.id,
          username: discordMsg.author.username,
          bot: discordMsg.author.bot,
        },
        attachments: discordMsg.attachments.map((att) => ({
          id: att.id,
          type: this.getAttachmentType(att.contentType),
          url: att.url,
          mimeType: att.contentType,
          filename: att.filename,
          size: att.size,
        })),
        instanceId,
      },
    };
  }

  /**
   * Handle incoming Discord message
   */
  async handle(discordMsg: DiscordMessage, instanceId: string): Promise<void> {
    const message = this.transformToInbound(discordMsg, instanceId);
    
    this.logger.debug(
      { messageId: message.id, sender: message.sender },
      'Handling inbound Discord message'
    );

    // Publish to Kafka topic
    await this.producer.send({
      topic: this.topic,
      messages: [
        {
          key: message.sender,
          value: JSON.stringify(message),
          headers: {
            instanceId,
            channel: 'discord',
            timestamp: String(message.timestamp),
          },
        },
      ],
    });

    this.logger.info(
      { messageId: message.id, topic: this.topic },
      'Published message to Kafka'
    );
  }

  /**
   * Determine attachment type from MIME content type
   */
  private getAttachmentType(mimeType: string): 'image' | 'video' | 'audio' | 'document' {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    return 'document';
  }
}
