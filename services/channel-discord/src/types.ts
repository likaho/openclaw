/**
 * Discord Channel Service Types
 */

import type { ServiceMessage, InboundMessage, ChannelStatus } from '../../shared/interfaces.js';

export interface DiscordConfig {
  botToken: string;
  guildId?: string;
  channelIds?: string[];
  messageQueue: string;
  redisUrl: string;
  kafkaBrokers: string[];
  controlPlaneUrl: string;
  logLevel: 'trace' | 'debug' | 'info' | 'warn' | 'error';
}

export interface DiscordMessage {
  id: string;
  channelId: string;
  guildId?: string;
  author: {
    id: string;
    username: string;
    discriminator: string;
    bot: boolean;
  };
  content: string;
  timestamp: string;
  attachments: Array<{
    id: string;
    filename: string;
    url: string;
    contentType: string;
    size: number;
  }>;
  embeds: unknown[];
  mentions: {
    users: Array<{ id: string; username: string }>;
    channels: Array<{ id: string; name: string }>;
    roles: Array<{ id: string; name: string }>;
  };
}

export interface DiscordChannelStatus extends ChannelStatus {
  channel: 'discord';
  guilds?: string[];
  channels?: string[];
  shardId?: number;
  shardCount?: number;
}

export interface DiscordEvent {
  type: string;
  data: DiscordMessage;
  timestamp: number;
}

export type DiscordMessageHandler = (message: InboundMessage) => Promise<void>;
export type DiscordStatusHandler = (status: DiscordChannelStatus) => Promise<void>;
