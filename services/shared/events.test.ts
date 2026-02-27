/**
 * Event Types Unit Tests
 * Tests for all Kafka event types and serialization
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  EventCategory,
  KAFKA_TOPICS,
  Events,
  EventSerializer,
  type MessageInboundEvent,
  type MessageOutboundEvent,
  type AgentStartedEvent,
  type AgentCompletedEvent,
  type ChannelConnectedEvent,
  type ChannelDisconnectedEvent,
  type OpenClawEvent,
} from '../services/shared/events.js';

describe('Event Types', () => {
  describe('EventCategory', () => {
    it('should have all expected categories', () => {
      expect(EventCategory.MESSAGE).toBe('message');
      expect(EventCategory.AGENT).toBe('agent');
      expect(EventCategory.CHANNEL).toBe('channel');
      expect(EventCategory.SESSION).toBe('session');
      expect(EventCategory.SYSTEM).toBe('system');
    });
  });

  describe('KAFKA_TOPICS', () => {
    it('should have message topics', () => {
      expect(KAFKA_TOPICS.MESSAGE_INBOUND).toBe('message.inbound');
      expect(KAFKA_TOPICS.MESSAGE_OUTBOUND).toBe('message.outbound');
    });

    it('should have agent topics', () => {
      expect(KAFKA_TOPICS.AGENT_STARTED).toBe('agent.started');
      expect(KAFKA_TOPICS.AGENT_COMPLETED).toBe('agent.completed');
    });

    it('should have channel topics', () => {
      expect(KAFKA_TOPICS.CHANNEL_CONNECTED).toBe('channel.connected');
      expect(KAFKA_TOPICS.CHANNEL_DISCONNECTED).toBe('channel.disconnected');
    });

    it('should have session topics', () => {
      expect(KAFKA_TOPICS.SESSION_CREATED).toBe('session.created');
      expect(KAFKA_TOPICS.SESSION_ENDED).toBe('session.ended');
    });

    it('should have system topics', () => {
      expect(KAFKA_TOPICS.SYSTEM_HEALTH).toBe('system.health');
      expect(KAFKA_TOPICS.SYSTEM_METRICS).toBe('system.metrics');
    });
  });

  describe('Events.createMessageInbound', () => {
    it('should create a valid inbound message event', () => {
      const payload = {
        id: 'msg-123',
        timestamp: Date.now(),
        channel: 'discord',
        sender: 'user-456',
        content: 'Hello world',
        metadata: { key: 'value' },
      };

      const event = Events.createMessageInbound(payload, 'channel-discord');

      expect(event.eventType).toBe('message.inbound');
      expect(event.category).toBe(EventCategory.MESSAGE);
      expect(event.source).toBe('channel-discord');
      expect(event.payload).toEqual(payload);
      expect(event.eventId).toMatch(/^msg-/);
      expect(event.version).toBe('1.0.0');
      expect(event.timestamp).toBeDefined();
    });

    it('should generate unique event IDs', () => {
      const payload = {
        id: 'msg-123',
        timestamp: Date.now(),
        channel: 'discord',
        sender: 'user-456',
        content: 'Hello',
      };

      const event1 = Events.createMessageInbound(payload, 'source');
      const event2 = Events.createMessageInbound(payload, 'source');

      expect(event1.eventId).not.toBe(event2.eventId);
    });
  });

  describe('Events.createMessageOutbound', () => {
    it('should create a valid outbound message event', () => {
      const payload = {
        messageId: 'out-123',
        targetChannel: 'C123456',
        targetUser: 'U123456',
        content: 'Response',
        priority: 'high',
      };

      const event = Events.createMessageOutbound(payload, 'control-plane');

      expect(event.eventType).toBe('message.outbound');
      expect(event.category).toBe(EventCategory.MESSAGE);
      expect(event.payload.messageId).toBe('out-123');
      expect(event.payload.priority).toBe('high');
    });

    it('should allow optional priority', () => {
      const payload = {
        messageId: 'out-123',
        targetChannel: 'C123456',
        targetUser: 'U123456',
        content: 'Response',
      };

      const event = Events.createMessageOutbound(payload, 'control-plane');

      expect(event.payload.priority).toBeUndefined();
    });
  });

  describe('Events.createAgentStarted', () => {
    it('should create a valid agent started event', () => {
      const payload = {
        taskId: 'task-123',
        sessionId: 'session-456',
        input: 'Process this',
        context: {
          sessionId: 'session-456',
          userId: 'user-789',
          channel: 'discord',
          messageId: 'msg-001',
          tools: ['bash', 'read'],
          model: 'claude-3-opus',
        },
        startedAt: Date.now(),
      };

      const event = Events.createAgentStarted(payload, 'agent-runtime');

      expect(event.eventType).toBe('agent.started');
      expect(event.category).toBe(EventCategory.AGENT);
      expect(event.payload.taskId).toBe('task-123');
      expect(event.payload.context.tools).toContain('bash');
    });
  });

  describe('Events.createAgentCompleted', () => {
    it('should create a valid agent completed event', () => {
      const payload = {
        taskId: 'task-123',
        success: true,
        output: 'Task completed',
        duration: 5000,
        tokensUsed: 1500,
        completedAt: Date.now(),
        duration: 5000,
      };

      const event = Events.createAgentCompleted(payload, 'agent-runtime');

      expect(event.eventType).toBe('agent.completed');
      expect(event.category).toBe(EventCategory.AGENT);
      expect(event.payload.success).toBe(true);
      expect(event.payload.tokensUsed).toBe(1500);
    });

    it('should handle failed agent result', () => {
      const payload = {
        taskId: 'task-123',
        success: false,
        output: '',
        error: 'Timeout',
        duration: 300000,
        completedAt: Date.now(),
        duration: 300000,
      };

      const event = Events.createAgentCompleted(payload, 'agent-runtime');

      expect(event.payload.success).toBe(false);
      expect(event.payload.error).toBe('Timeout');
    });
  });

  describe('Events.createChannelConnected', () => {
    it('should create a valid channel connected event', () => {
      const payload = {
        connected: true,
        channel: 'discord',
        lastHeartbeat: Date.now(),
        messageCount: 100,
        errorCount: 0,
        instanceId: 'discord-001',
        connectedAt: Date.now(),
      };

      const event = Events.createChannelConnected(payload, 'channel-discord');

      expect(event.eventType).toBe('channel.connected');
      expect(event.category).toBe(EventCategory.CHANNEL);
      expect(event.payload.connected).toBe(true);
      expect(event.payload.channel).toBe('discord');
    });
  });

  describe('Events.createChannelDisconnected', () => {
    it('should create a valid channel disconnected event', () => {
      const payload = {
        channel: 'telegram',
        instanceId: 'telegram-001',
        disconnectedAt: Date.now(),
        reason: 'network_error',
        lastHeartbeat: Date.now() - 60000,
      };

      const event = Events.createChannelDisconnected(payload, 'channel-telegram');

      expect(event.eventType).toBe('channel.disconnected');
      expect(event.category).toBe(EventCategory.CHANNEL);
      expect(event.payload.connected).toBeUndefined();
      expect(event.payload.reason).toBe('network_error');
    });
  });
});

describe('EventSerializer', () => {
  const sampleEvent: MessageInboundEvent = {
    eventId: 'msg-123',
    eventType: 'message.inbound',
    category: EventCategory.MESSAGE,
    timestamp: Date.now(),
    source: 'channel-discord',
    version: '1.0.0',
    payload: {
      id: 'msg-123',
      timestamp: Date.now(),
      channel: 'discord',
      sender: 'user-456',
      content: 'Hello',
    },
  };

  describe('serialize', () => {
    it('should serialize event to JSON string', () => {
      const serialized = EventSerializer.serialize(sampleEvent);

      expect(typeof serialized).toBe('string');
      expect(serialized).toContain('"eventType":"message.inbound"');
      expect(serialized).toContain('"category":"message"');
    });

    it('should serialize all event types', () => {
      const outbound: MessageOutboundEvent = {
        ...sampleEvent,
        eventType: 'message.outbound',
        payload: { ...sampleEvent.payload, messageId: 'out-123' },
      };

      const serialized = EventSerializer.serialize(outbound);
      expect(serialized).toContain('message.outbound');
    });
  });

  describe('deserialize', () => {
    it('should deserialize JSON string to event', () => {
      const serialized = EventSerializer.serialize(sampleEvent);
      const deserialized = EventSerializer.deserialize(serialized);

      expect(deserialized.eventId).toBe(sampleEvent.eventId);
      expect(deserialized.eventType).toBe(sampleEvent.eventType);
      expect(deserialized.category).toBe(sampleEvent.category);
      expect(deserialized.payload.channel).toBe('discord');
    });

    it('should handle complex payloads', () => {
      const event: AgentStartedEvent = {
        eventId: 'agent-123',
        eventType: 'agent.started',
        category: EventCategory.AGENT,
        timestamp: Date.now(),
        source: 'agent-runtime',
        version: '1.0.0',
        payload: {
          taskId: 'task-123',
          sessionId: 'session-456',
          input: 'test',
          context: {
            sessionId: 'session-456',
            userId: 'user-789',
            channel: 'discord',
            messageId: 'msg-001',
            tools: ['bash', 'read', 'write'],
          },
          startedAt: Date.now(),
        },
      };

      const serialized = EventSerializer.serialize(event);
      const deserialized = EventSerializer.deserialize(serialized) as AgentStartedEvent;

      expect(deserialized.payload.context.tools).toHaveLength(3);
    });
  });

  describe('getTopic', () => {
    it('should return correct topic for message events', () => {
      expect(EventSerializer.getTopic('message.inbound')).toBe(KAFKA_TOPICS.MESSAGE_INBOUND);
      expect(EventSerializer.getTopic('message.outbound')).toBe(KAFKA_TOPICS.MESSAGE_OUTBOUND);
    });

    it('should return correct topic for agent events', () => {
      expect(EventSerializer.getTopic('agent.started')).toBe(KAFKA_TOPICS.AGENT_STARTED);
      expect(EventSerializer.getTopic('agent.completed')).toBe(KAFKA_TOPICS.AGENT_COMPLETED);
      expect(EventSerializer.getTopic('agent.failed')).toBe(KAFKA_TOPICS.AGENT_FAILED);
    });

    it('should return correct topic for channel events', () => {
      expect(EventSerializer.getTopic('channel.connected')).toBe(KAFKA_TOPICS.CHANNEL_CONNECTED);
      expect(EventSerializer.getTopic('channel.disconnected')).toBe(KAFKA_TOPICS.CHANNEL_DISCONNECTED);
      expect(EventSerializer.getTopic('channel.error')).toBe(KAFKA_TOPICS.CHANNEL_ERROR);
    });

    it('should return correct topic for session events', () => {
      expect(EventSerializer.getTopic('session.created')).toBe(KAFKA_TOPICS.SESSION_CREATED);
      expect(EventSerializer.getTopic('session.ended')).toBe(KAFKA_TOPICS.SESSION_ENDED);
    });

    it('should return correct topic for system events', () => {
      expect(EventSerializer.getTopic('system.health')).toBe(KAFKA_TOPICS.SYSTEM_HEALTH);
      expect(EventSerializer.getTopic('system.metrics')).toBe(KAFKA_TOPICS.SYSTEM_METRICS);
    });

    it('should return unknown topic for unrecognized events', () => {
      expect(EventSerializer.getTopic('unknown.event')).toBe('system.unknown');
      expect(EventSerializer.getTopic('')).toBe('system.unknown');
    });
  });
});

describe('OpenClawEvent Union Type', () => {
  it('should accept message inbound events', () => {
    const event: OpenClawEvent = Events.createMessageInbound(
      {
        id: 'msg-123',
        timestamp: Date.now(),
        channel: 'discord',
        sender: 'user-456',
        content: 'Hello',
      },
      'source'
    );
    expect(event.eventType).toBe('message.inbound');
  });

  it('should accept channel connected events', () => {
    const event: OpenClawEvent = Events.createChannelConnected(
      {
        connected: true,
        channel: 'discord',
        lastHeartbeat: Date.now(),
        messageCount: 0,
        errorCount: 0,
        instanceId: 'test',
        connectedAt: Date.now(),
      },
      'source'
    );
    expect(event.eventType).toBe('channel.connected');
  });

  it('should accept agent completed events', () => {
    const event: OpenClawEvent = Events.createAgentCompleted(
      {
        taskId: 'task-123',
        success: true,
        output: 'done',
        duration: 1000,
        tokensUsed: 100,
        completedAt: Date.now(),
        duration: 1000,
      },
      'source'
    );
    expect(event.eventType).toBe('agent.completed');
  });
});
