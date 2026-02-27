/**
 * Discord Channel Service Configuration
 */

import { z } from 'zod';

export const DiscordConfigSchema = z.object({
  botToken: z.string().min(1),
  guildId: z.string().optional(),
  channelIds: z.array(z.string()).optional(),
  messageQueue: z.string().default('discord:inbound'),
  redisUrl: z.string().url().default('redis://localhost:6379'),
  kafkaBrokers: z.array(z.string()).default(['localhost:9092']),
  controlPlaneUrl: z.string().url().default('http://control-plane:3000'),
  logLevel: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
});

export type DiscordConfig = z.infer<typeof DiscordConfigSchema>;

export function loadConfig(): DiscordConfig {
  const env = {
    DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN,
    DISCORD_GUILD_ID: process.env.DISCORD_GUILD_ID,
    DISCORD_CHANNEL_IDS: process.env.DISCORD_CHANNEL_IDS,
    MESSAGE_QUEUE: process.env.MESSAGE_QUEUE || 'discord:inbound',
    REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
    KAFKA_BROKERS: process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'],
    CONTROL_PLANE_URL: process.env.CONTROL_PLANE_URL || 'http://control-plane:3000',
    LOG_LEVEL: process.env.LOG_LEVEL as DiscordConfig['logLevel'] || 'info',
  };

  const parsed = DiscordConfigSchema.safeParse({
    botToken: env.DISCORD_BOT_TOKEN,
    guildId: env.DISCORD_GUILD_ID,
    channelIds: env.DISCORD_CHANNEL_IDS?.split(','),
    messageQueue: env.MESSAGE_QUEUE,
    redisUrl: env.REDIS_URL,
    kafkaBrokers: env.KAFKA_BROKERS,
    controlPlaneUrl: env.CONTROL_PLANE_URL,
    logLevel: env.LOG_LEVEL,
  });

  if (!parsed.success) {
    throw new Error(`Invalid Discord config: ${parsed.error.errors}`);
  }

  return parsed.data;
}
