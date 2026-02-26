/**
 * OpenClaw Service Interfaces
 * 
 * These interfaces define the contract between microservices.
 * Each service implements these interfaces for inter-service communication.
 */

import type { Readable } from 'node:stream';

/**
 * Common message types for inter-service communication
 */
export interface ServiceMessage {
  id: string;
  timestamp: number;
  channel: string;
  sender: string;
  content: string;
  metadata?: Record<string, unknown>;
}

/**
 * Inbound message from a channel service to the control plane
 */
export interface InboundMessage extends ServiceMessage {
  channel: string;
  rawEvent: unknown;
  attachments?: Attachment[];
}

/**
 * Outbound message from control plane to a channel service
 */
export interface OutboundMessage extends ServiceMessage {
  targetChannel: string;
  targetUser: string;
  priority?: 'high' | 'normal' | 'low';
}

/**
 * Media attachment
 */
export interface Attachment {
  id: string;
  type: 'image' | 'video' | 'audio' | 'document';
  url: string;
  mimeType: string;
  size?: number;
  filename?: string;
}

/**
 * Channel service status
 */
export interface ChannelStatus {
  connected: boolean;
  channel: string;
  lastHeartbeat: number;
  messageCount: number;
  errorCount: number;
  instanceId: string;
}

/**
 * Service health status
 */
export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  service: string;
  version: string;
  uptime: number;
  checks: HealthCheck[];
}

export interface HealthCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message?: string;
  timestamp: number;
}

/**
 * Service metrics for monitoring
 */
export interface ServiceMetrics {
  service: string;
  timestamp: number;
  counters: Record<string, number>;
  gauges: Record<string, number>;
  histograms: Record<string, number>;
}

/**
 * Agent task for the agent runtime
 */
export interface AgentTask {
  id: string;
  sessionId: string;
  input: string;
  context: AgentContext;
  priority: 'high' | 'normal' | 'low';
  timeout?: number;
}

export interface AgentContext {
  sessionId: string;
  userId: string;
  channel: string;
  messageId: string;
  tools: string[];
  model?: string;
}

export interface AgentResult {
  taskId: string;
  success: boolean;
  output: string;
  error?: string;
  duration: number;
  tokensUsed?: number;
}

/**
 * Session information
 */
export interface Session {
  id: string;
  userId: string;
  channel: string;
  createdAt: number;
  updatedAt: number;
  metadata: Record<string, unknown>;
}

/**
 * Configuration for a service
 */
export interface ServiceConfig {
  serviceName: string;
  port: number;
  redisUrl: string;
  messageQueue: string;
  controlPlaneUrl?: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  tracingEnabled: boolean;
  metricsEnabled: boolean;
}

/**
 * gRPC service definitions for inter-service communication
 */
export interface IServiceClient {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
}

export interface IChannelService extends IServiceClient {
  /**
   * Send a message through this channel
   */
  sendMessage(target: string, message: OutboundMessage): Promise<void>;
  
  /**
   * Get the current status of this channel
   */
  getStatus(): Promise<ChannelStatus>;
  
  /**
   * Subscribe to inbound messages
   */
  onMessage(handler: (message: InboundMessage) => void): void;
  
  /**
   * Subscribe to status changes
   */
  onStatusChange(handler: (status: ChannelStatus) => void): void;
}

export interface IControlPlane extends IServiceClient {
  /**
   * Forward an inbound message to the agent runtime
   */
  routeMessage(message: InboundMessage): Promise<void>;
  
  /**
   * Send an outbound message to the appropriate channel service
   */
  sendToChannel(message: OutboundMessage): Promise<void>;
  
  /**
   * Get all active sessions
   */
  getActiveSessions(): Promise<Session[]>;
  
  /**
   * Subscribe to agent results
   */
  onAgentResult(handler: (result: AgentResult) => void): void;
}

export interface IAgentRuntime extends IServiceClient {
  /**
   * Execute an agent task
   */
  executeTask(task: AgentTask): Promise<AgentResult>;
  
  /**
   * Abort a running task
   */
  abortTask(taskId: string): Promise<void>;
  
  /**
   * Subscribe to task events
   */
  onTaskEvent(handler: (event: TaskEvent) => void): void;
}

export interface TaskEvent {
  taskId: string;
  eventType: 'started' | 'progress' | 'completed' | 'failed';
  data?: unknown;
}

/**
 * Message queue interface
 */
export interface IMessageQueue {
  /**
   * Publish a message to a queue
   */
  publish(queue: string, message: unknown): Promise<void>;
  
  /**
   * Subscribe to a queue
   */
  subscribe(queue: string, handler: (message: unknown) => void): Promise<void>;
  
  /**
   * Get queue length
   */
  getQueueLength(queue: string): Promise<number>;
  
  /**
   * Close connection
   */
  close(): Promise<void>;
}

/**
 * Cache interface
 */
export interface ICache {
  /**
   * Get a value
   */
  get<T>(key: string): Promise<T | null>;
  
  /**
   * Set a value with TTL
   */
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  
  /**
   * Delete a key
   */
  delete(key: string): Promise<void>;
  
  /**
   * Check if key exists
   */
  exists(key: string): Promise<boolean>;
}
