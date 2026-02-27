/**
 * Service Interfaces Tests
 * Tests for TypeScript interfaces and type definitions
 */

import { describe, it, expect } from 'vitest';
import type {
  ServiceMessage,
  InboundMessage,
  OutboundMessage,
  Attachment,
  ChannelStatus,
  HealthStatus,
  HealthCheck,
  ServiceMetrics,
  AgentTask,
  AgentResult,
  Session,
  ServiceConfig,
  IServiceClient,
  IChannelService,
  IControlPlane,
  IAgentRuntime,
  TaskEvent,
  IMessageQueue,
  ICache,
} from '../services/shared/interfaces.js';

describe('Service Interfaces', () => {
  describe('ServiceMessage', () => {
    it('should have required fields', () => {
      const message: ServiceMessage = {
        id: 'msg-123',
        timestamp: Date.now(),
        channel: 'discord',
        sender: 'user-123',
        content: 'Hello',
      };

      expect(message.id).toBeDefined();
      expect(message.timestamp).toBeDefined();
      expect(message.channel).toBe('discord');
      expect(message.sender).toBe('user-123');
      expect(message.content).toBe('Hello');
    });

    it('should allow optional metadata', () => {
      const message: ServiceMessage = {
        id: 'msg-123',
        timestamp: Date.now(),
        channel: 'discord',
        sender: 'user-123',
        content: 'Hello',
        metadata: { priority: 'high' },
      };

      expect(message.metadata?.priority).toBe('high');
    });
  });

  describe('InboundMessage', () => {
    it('should extend ServiceMessage with channel-specific fields', () => {
      const inbound: InboundMessage = {
        id: 'inbound-123',
        timestamp: Date.now(),
        channel: 'telegram',
        sender: 'user-456',
        content: 'Test message',
        rawEvent: { update_id: 12345 },
        attachments: [
          {
            id: 'att-1',
            type: 'image',
            url: 'https://example.com/image.jpg',
            mimeType: 'image/jpeg',
          },
        ],
      };

      expect(inbound.channel).toBe('telegram');
      expect(inbound.rawEvent).toBeDefined();
      expect(inbound.attachments?.length).toBe(1);
      expect(inbound.attachments?.[0].type).toBe('image');
    });
  });

  describe('OutboundMessage', () => {
    it('should include target information', () => {
      const outbound: OutboundMessage = {
        id: 'outbound-123',
        timestamp: Date.now(),
        channel: 'slack',
        sender: 'agent-001',
        content: 'Response message',
        targetChannel: 'C123456',
        targetUser: 'U123456',
        priority: 'high',
      };

      expect(outbound.targetChannel).toBe('C123456');
      expect(outbound.targetUser).toBe('U123456');
      expect(outbound.priority).toBe('high');
    });

    it('should allow default priority', () => {
      const outbound: OutboundMessage = {
        id: 'outbound-123',
        timestamp: Date.now(),
        channel: 'slack',
        sender: 'agent-001',
        content: 'Response message',
        targetChannel: 'C123456',
        targetUser: 'U123456',
      };

      expect(outbound.priority).toBeUndefined();
    });
  });

  describe('Attachment', () => {
    it('should define all attachment types', () => {
      const types: Attachment['type'][] = ['image', 'video', 'audio', 'document'];

      types.forEach((type) => {
        const attachment: Attachment = {
          id: 'att-1',
          type,
          url: `https://example.com/file.${type === 'image' ? 'jpg' : type === 'video' ? 'mp4' : type === 'audio' ? 'mp3' : 'pdf'}`,
          mimeType: type === 'image' ? 'image/jpeg' : type === 'video' ? 'video/mp4' : type === 'audio' ? 'audio/mpeg' : 'application/pdf',
          size: 1024,
          filename: `file.${type === 'image' ? 'jpg' : type === 'video' ? 'mp4' : type === 'audio' ? 'mp3' : 'pdf'}`,
        };

        expect(attachment.type).toBe(type);
      });
    });
  });

  describe('ChannelStatus', () => {
    it('should define connected status', () => {
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

    it('should define disconnected status', () => {
      const status: ChannelStatus = {
        connected: false,
        channel: 'telegram',
        lastHeartbeat: Date.now() - 60000,
        messageCount: 50,
        errorCount: 5,
        instanceId: 'telegram-001',
      };

      expect(status.connected).toBe(false);
      expect(status.errorCount).toBeGreaterThan(0);
    });
  });

  describe('HealthStatus', () => {
    it('should define healthy status', () => {
      const healthy: HealthStatus = {
        status: 'healthy',
        service: 'api-gateway',
        version: '2026.2.26',
        uptime: 3600,
        checks: [
          { name: 'server', status: 'pass', timestamp: Date.now() },
          { name: 'redis', status: 'pass', timestamp: Date.now() },
        ],
      };

      expect(healthy.status).toBe('healthy');
      expect(healthy.checks.every((c) => c.status === 'pass')).toBe(true);
    });

    it('should define degraded status', () => {
      const degraded: HealthStatus = {
        status: 'degraded',
        service: 'api-gateway',
        version: '2026.2.26',
        uptime: 3600,
        checks: [
          { name: 'server', status: 'pass', timestamp: Date.now() },
          { name: 'redis', status: 'warn', message: 'High latency', timestamp: Date.now() },
        ],
      };

      expect(degraded.status).toBe('degraded');
      expect(degraded.checks.some((c) => c.status === 'warn')).toBe(true);
    });

    it('should define unhealthy status', () => {
      const unhealthy: HealthStatus = {
        status: 'unhealthy',
        service: 'api-gateway',
        version: '2026.2.26',
        uptime: 60,
        checks: [
          { name: 'server', status: 'fail', message: 'Connection refused', timestamp: Date.now() },
        ],
      };

      expect(unhealthy.status).toBe('unhealthy');
      expect(unhealthy.checks[0].status).toBe('fail');
    });
  });

  describe('ServiceMetrics', () => {
    it('should track counters', () => {
      const metrics: ServiceMetrics = {
        service: 'control-plane',
        timestamp: Date.now(),
        counters: {
          requests_total: 1000,
          errors_total: 5,
        },
        gauges: {},
        histograms: {},
      };

      expect(metrics.counters.requests_total).toBe(1000);
      expect(metrics.counters.errors_total).toBe(5);
    });

    it('should track gauges', () => {
      const metrics: ServiceMetrics = {
        service: 'agent-runtime',
        timestamp: Date.now(),
        counters: {},
        gauges: {
          active_tasks: 10,
          memory_usage_mb: 512,
        },
        histograms: {},
      };

      expect(metrics.gauges.active_tasks).toBe(10);
      expect(metrics.gauges.memory_usage_mb).toBe(512);
    });

    it('should track histograms', () => {
      const metrics: ServiceMetrics = {
        service: 'api-gateway',
        timestamp: Date.now(),
        counters: {},
        gauges: {},
        histograms: {
          request_duration_ms: 150,
          response_size_bytes: 2048,
        },
      };

      expect(metrics.histograms.request_duration_ms).toBe(150);
    });
  });

  describe('AgentTask', () => {
    it('should define agent task structure', () => {
      const task: AgentTask = {
        id: 'task-123',
        sessionId: 'session-456',
        input: 'Process this request',
        context: {
          sessionId: 'session-456',
          userId: 'user-789',
          channel: 'discord',
          messageId: 'msg-001',
          tools: ['bash', 'read', 'write'],
          model: 'claude-3-opus',
        },
        priority: 'high',
        timeout: 300000,
      };

      expect(task.id).toBeDefined();
      expect(task.sessionId).toBe('session-456');
      expect(task.context.tools).toContain('bash');
      expect(task.priority).toBe('high');
      expect(task.timeout).toBe(300000);
    });

    it('should allow default priority and timeout', () => {
      const task: AgentTask = {
        id: 'task-123',
        sessionId: 'session-456',
        input: 'Process this request',
        context: {
          sessionId: 'session-456',
          userId: 'user-789',
          channel: 'discord',
          messageId: 'msg-001',
          tools: ['bash'],
        },
      };

      expect(task.priority).toBeUndefined();
      expect(task.timeout).toBeUndefined();
    });
  });

  describe('AgentResult', () => {
    it('should define successful result', () => {
      const result: AgentResult = {
        taskId: 'task-123',
        success: true,
        output: 'Task completed successfully',
        duration: 5000,
        tokensUsed: 1500,
      };

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
      expect(result.duration).toBe(5000);
    });

    it('should define failed result with error', () => {
      const result: AgentResult = {
        taskId: 'task-123',
        success: false,
        output: '',
        error: 'Timeout exceeded',
        duration: 300000,
      };

      expect(result.success).toBe(false);
      expect(result.error).toBe('Timeout exceeded');
    });
  });

  describe('Session', () => {
    it('should define session structure', () => {
      const session: Session = {
        id: 'session-123',
        userId: 'user-456',
        channel: 'telegram',
        createdAt: Date.now() - 3600000,
        updatedAt: Date.now(),
        metadata: {
          language: 'en',
          timezone: 'UTC',
        },
      };

      expect(session.id).toBeDefined();
      expect(session.userId).toBe('user-456');
      expect(session.channel).toBe('telegram');
      expect(session.createdAt).toBeLessThan(session.updatedAt);
    });
  });

  describe('ServiceConfig', () => {
    it('should define complete config', () => {
      const config: ServiceConfig = {
        serviceName: 'channel-discord',
        port: 3000,
        redisUrl: 'redis://localhost:6379',
        messageQueue: 'discord:inbound',
        controlPlaneUrl: 'http://control-plane:3000',
        logLevel: 'info',
        tracingEnabled: true,
        metricsEnabled: true,
      };

      expect(config.serviceName).toBe('channel-discord');
      expect(config.port).toBe(3000);
      expect(config.redisUrl).toContain('redis');
      expect(config.tracingEnabled).toBe(true);
    });
  });

  describe('TaskEvent', () => {
    it('should define all event types', () => {
      const events: TaskEvent[] = [
        { taskId: 'task-1', eventType: 'started' },
        { taskId: 'task-1', eventType: 'progress', data: { progress: 50 } },
        { taskId: 'task-1', eventType: 'completed', data: { result: 'success' } },
        { taskId: 'task-1', eventType: 'failed', data: { error: 'timeout' } },
      ];

      expect(events[0].eventType).toBe('started');
      expect(events[1].eventType).toBe('progress');
      expect(events[2].eventType).toBe('completed');
      expect(events[3].eventType).toBe('failed');
    });
  });
});

describe('Interface Contracts', () => {
  describe('IServiceClient', () => {
    it('should define connection methods', () => {
      const client: IServiceClient = {
        connect: async () => {},
        disconnect: async () => {},
        isConnected: () => true,
      };

      expect(typeof client.connect).toBe('function');
      expect(typeof client.disconnect).toBe('function');
      expect(typeof client.isConnected).toBe('function');
    });
  });

  describe('IChannelService', () => {
    it('should define channel service interface', () => {
      const channelService: IChannelService = {
        connect: async () => {},
        disconnect: async () => {},
        isConnected: () => true,
        sendMessage: async (target, message) => {},
        getStatus: async () => ({
          connected: true,
          channel: 'discord',
          lastHeartbeat: Date.now(),
          messageCount: 0,
          errorCount: 0,
          instanceId: 'test',
        }),
        onMessage: (handler) => {},
        onStatusChange: (handler) => {},
      };

      expect(typeof channelService.sendMessage).toBe('function');
      expect(typeof channelService.getStatus).toBe('function');
      expect(typeof channelService.onMessage).toBe('function');
    });
  });

  describe('IControlPlane', () => {
    it('should define control plane interface', () => {
      const controlPlane: IControlPlane = {
        connect: async () => {},
        disconnect: async () => {},
        isConnected: () => true,
        routeMessage: async (message) => {},
        sendToChannel: async (message) => {},
        getActiveSessions: async () => [],
        onAgentResult: (handler) => {},
      };

      expect(typeof controlPlane.routeMessage).toBe('function');
      expect(typeof controlPlane.sendToChannel).toBe('function');
      expect(typeof controlPlane.getActiveSessions).toBe('function');
    });
  });

  describe('IAgentRuntime', () => {
    it('should define agent runtime interface', () => {
      const runtime: IAgentRuntime = {
        connect: async () => {},
        disconnect: async () => {},
        isConnected: () => true,
        executeTask: async (task) => ({
          taskId: task.id,
          success: true,
          output: 'done',
          duration: 1000,
        }),
        abortTask: async (taskId) => {},
        onTaskEvent: (handler) => {},
      };

      expect(typeof runtime.executeTask).toBe('function');
      expect(typeof runtime.abortTask).toBe('function');
      expect(typeof runtime.onTaskEvent).toBe('function');
    });
  });

  describe('IMessageQueue', () => {
    it('should define message queue interface', () => {
      const queue: IMessageQueue = {
        publish: async (queue, message) => {},
        subscribe: async (queue, handler) => {},
        getQueueLength: async (queue) => 0,
        close: async () => {},
      };

      expect(typeof queue.publish).toBe('function');
      expect(typeof queue.subscribe).toBe('function');
      expect(typeof queue.getQueueLength).toBe('function');
    });
  });

  describe('ICache', () => {
    it('should define cache interface', () => {
      const cache: ICache = {
        get: async (key) => null,
        set: async (key, value, ttl) => {},
        delete: async (key) => {},
        exists: async (key) => false,
      };

      expect(typeof cache.get).toBe('function');
      expect(typeof cache.set).toBe('function');
      expect(typeof cache.delete).toBe('function');
      expect(typeof cache.exists).toBe('function');
    });
  });
});
