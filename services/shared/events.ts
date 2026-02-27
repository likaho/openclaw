/**
 * OpenClaw Event Types for Kafka Message Passing
 * 
 * This module defines all event types used for asynchronous communication
 * between microservices via Apache Kafka.
 */

import type { ServiceMessage, ChannelStatus, AgentTask, AgentResult, Session } from './interfaces.js';

/**
 * Event Categories
 */
export enum EventCategory {
  MESSAGE = 'message',
  AGENT = 'agent',
  CHANNEL = 'channel',
  SESSION = 'session',
  SYSTEM = 'system',
}

/**
 * Kafka Topic Names
 */
export const KAFKA_TOPICS = {
  // Message events
  MESSAGE_INBOUND: 'message.inbound',
  MESSAGE_OUTBOUND: 'message.outbound',
  
  // Agent events
  AGENT_STARTED: 'agent.started',
  AGENT_COMPLETED: 'agent.completed',
  AGENT_FAILED: 'agent.failed',
  
  // Channel events
  CHANNEL_CONNECTED: 'channel.connected',
  CHANNEL_DISCONNECTED: 'channel.disconnected',
  CHANNEL_ERROR: 'channel.error',
  
  // Session events
  SESSION_CREATED: 'session.created',
  SESSION_ENDED: 'session.ended',
  
  // System events
  SYSTEM_HEALTH: 'system.health',
  SYSTEM_METRICS: 'system.metrics',
} as const;

/**
 * Base event interface
 */
export interface BaseEvent<T = unknown> {
  eventId: string;
  eventType: string;
  category: EventCategory;
  timestamp: number;
  source: string;
  version: string;
  payload: T;
  metadata?: Record<string, unknown>;
}

/**
 * Message Inbound Event
 * Fired when a new message is received from a channel
 */
export interface MessageInboundEvent extends BaseEvent<ServiceMessage> {
  eventType: 'message.inbound';
  category: EventCategory.MESSAGE;
  payload: ServiceMessage & {
    channel: string;
    rawEvent: unknown;
    attachments?: Array<{
      id: string;
      type: 'image' | 'video' | 'audio' | 'document';
      url: string;
      mimeType: string;
    }>;
  };
}

/**
 * Message Outbound Event
 * Fired when a message needs to be sent to a channel
 */
export interface MessageOutboundEvent extends BaseEvent<{
  messageId: string;
  targetChannel: string;
  targetUser: string;
  content: string;
  priority?: 'high' | 'normal' | 'low';
  replyTo?: string;
}> {
  eventType: 'message.outbound';
  category: EventCategory.MESSAGE;
}

/**
 * Agent Started Event
 * Fired when an agent session begins processing
 */
export interface AgentStartedEvent extends BaseEvent<{
  taskId: string;
  sessionId: string;
  input: string;
  context: {
    sessionId: string;
    userId: string;
    channel: string;
    messageId: string;
    tools: string[];
    model?: string;
  };
  startedAt: number;
}> {
  eventType: 'agent.started';
  category: EventCategory.AGENT;
}

/**
 * Agent Completed Event
 * Fired when an agent task completes successfully
 */
export interface AgentCompletedEvent extends BaseEvent<AgentResult & {
  completedAt: number;
  duration: number;
}> {
  eventType: 'agent.completed';
  category: EventCategory.AGENT;
}

/**
 * Agent Failed Event
 * Fired when an agent task fails
 */
export interface AgentFailedEvent extends BaseEvent<{
  taskId: string;
  sessionId: string;
  error: string;
  failedAt: number;
  retryable: boolean;
}> {
  eventType: 'agent.failed';
  category: EventCategory.AGENT;
}

/**
 * Channel Connected Event
 * Fired when a channel service comes online
 */
export interface ChannelConnectedEvent extends BaseEvent<ChannelStatus & {
  connectedAt: number;
  instanceId: string;
}> {
  eventType: 'channel.connected';
  category: EventCategory.CHANNEL;
}

/**
 * Channel Disconnected Event
 * Fired when a channel service goes offline
 */
export interface ChannelDisconnectedEvent extends BaseEvent<{
  channel: string;
  instanceId: string;
  disconnectedAt: number;
  reason?: string;
  lastHeartbeat: number;
}> {
  eventType: 'channel.disconnected';
  category: EventCategory.CHANNEL;
}

/**
 * Channel Error Event
 * Fired when a channel encounters an error
 */
export interface ChannelErrorEvent extends BaseEvent<{
  channel: string;
  instanceId: string;
  error: string;
  errorCode?: string;
  recoverable: boolean;
}> {
  eventType: 'channel.error';
  category: EventCategory.CHANNEL;
}

/**
 * Session Created Event
 * Fired when a new session is created
 */
export interface SessionCreatedEvent extends BaseEvent<Session> {
  eventType: 'session.created';
  category: EventCategory.SESSION;
}

/**
 * Session Ended Event
 * Fired when a session ends
 */
export interface SessionEndedEvent extends BaseEvent<{
  sessionId: string;
  userId: string;
  channel: string;
  endedAt: number;
  duration: number;
  reason?: 'completed' | 'timeout' | 'user_disconnected' | 'error';
}> {
  eventType: 'session.ended';
  category: EventCategory.SESSION;
}

/**
 * System Health Event
 * Periodic health status update
 */
export interface SystemHealthEvent extends BaseEvent<{
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: Array<{
    name: string;
    status: 'pass' | 'warn' | 'fail';
    message?: string;
  }>;
  uptime: number;
  timestamp: number;
}> {
  eventType: 'system.health';
  category: EventCategory.SYSTEM;
}

/**
 * System Metrics Event
 * Periodic metrics update
 */
export interface SystemMetricsEvent extends BaseEvent<{
  service: string;
  metrics: {
    counters: Record<string, number>;
    gauges: Record<string, number>;
    histograms: Record<string, number[]>;
  };
  timestamp: number;
}> {
  eventType: 'system.metrics';
  category: EventCategory.SYSTEM;
}

/**
 * Union type of all OpenClaw events
 */
export type OpenClawEvent =
  | MessageInboundEvent
  | MessageOutboundEvent
  | AgentStartedEvent
  | AgentCompletedEvent
  | AgentFailedEvent
  | ChannelConnectedEvent
  | ChannelDisconnectedEvent
  | ChannelErrorEvent
  | SessionCreatedEvent
  | SessionEndedEvent
  | SystemHealthEvent
  | SystemMetricsEvent;

/**
 * Event factory functions
 */
export const Events = {
  /**
   * Create a message inbound event
   */
  createMessageInbound(payload: MessageInboundEvent['payload'], source: string): MessageInboundEvent {
    return {
      eventId: `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      eventType: 'message.inbound',
      category: EventCategory.MESSAGE,
      timestamp: Date.now(),
      source,
      version: '1.0.0',
      payload,
    };
  },

  /**
   * Create a message outbound event
   */
  createMessageOutbound(payload: MessageOutboundEvent['payload'], source: string): MessageOutboundEvent {
    return {
      eventId: `msg-out-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      eventType: 'message.outbound',
      category: EventCategory.MESSAGE,
      timestamp: Date.now(),
      source,
      version: '1.0.0',
      payload,
    };
  },

  /**
   * Create an agent started event
   */
  createAgentStarted(payload: AgentStartedEvent['payload'], source: string): AgentStartedEvent {
    return {
      eventId: `agent-start-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      eventType: 'agent.started',
      category: EventCategory.AGENT,
      timestamp: Date.now(),
      source,
      version: '1.0.0',
      payload,
    };
  },

  /**
   * Create an agent completed event
   */
  createAgentCompleted(payload: AgentCompletedEvent['payload'], source: string): AgentCompletedEvent {
    return {
      eventId: `agent-complete-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      eventType: 'agent.completed',
      category: EventCategory.AGENT,
      timestamp: Date.now(),
      source,
      version: '1.0.0',
      payload,
    };
  },

  /**
   * Create a channel connected event
   */
  createChannelConnected(payload: ChannelConnectedEvent['payload'], source: string): ChannelConnectedEvent {
    return {
      eventId: `channel-connect-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      eventType: 'channel.connected',
      category: EventCategory.CHANNEL,
      timestamp: Date.now(),
      source,
      version: '1.0.0',
      payload,
    };
  },

  /**
   * Create a channel disconnected event
   */
  createChannelDisconnected(payload: ChannelDisconnectedEvent['payload'], source: string): ChannelDisconnectedEvent {
    return {
      eventId: `channel-disconnect-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      eventType: 'channel.disconnected',
      category: EventCategory.CHANNEL,
      timestamp: Date.now(),
      source,
      version: '1.0.0',
      payload,
    };
  },
};

/**
 * Event serialization helpers
 */
export const EventSerializer = {
  /**
   * Serialize event to JSON string
   */
  serialize(event: OpenClawEvent): string {
    return JSON.stringify(event);
  },

  /**
   * Deserialize event from JSON string
   */
  deserialize(json: string): OpenClawEvent {
    return JSON.parse(json) as OpenClawEvent;
  },

  /**
   * Get Kafka topic for event type
   */
  getTopic(eventType: string): string {
    const topicMap: Record<string, string> = {
      'message.inbound': KAFKA_TOPICS.MESSAGE_INBOUND,
      'message.outbound': KAFKA_TOPICS.MESSAGE_OUTBOUND,
      'agent.started': KAFKA_TOPICS.AGENT_STARTED,
      'agent.completed': KAFKA_TOPICS.AGENT_COMPLETED,
      'agent.failed': KAFKA_TOPICS.AGENT_FAILED,
      'channel.connected': KAFKA_TOPICS.CHANNEL_CONNECTED,
      'channel.disconnected': KAFKA_TOPICS.CHANNEL_DISCONNECTED,
      'channel.error': KAFKA_TOPICS.CHANNEL_ERROR,
      'session.created': KAFKA_TOPICS.SESSION_CREATED,
      'session.ended': KAFKA_TOPICS.SESSION_ENDED,
      'system.health': KAFKA_TOPICS.SYSTEM_HEALTH,
      'system.metrics': KAFKA_TOPICS.SYSTEM_METRICS,
    };
    
    return topicMap[eventType] || 'system.unknown';
  },
};
