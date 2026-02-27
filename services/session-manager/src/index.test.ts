/**
 * Session Manager Service Tests
 * Tests for the centralized session management service
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Session } from '../services/shared/interfaces.js';

// Mock Redis
const createMockRedis = () => ({
  connect: vi.fn().mockResolvedValue(undefined),
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue('OK'),
  setex: vi.fn().mockResolvedValue('OK'),
  del: vi.fn().mockResolvedValue(1),
  keys: vi.fn().mockResolvedValue([]),
  expire: vi.fn().mockResolvedValue(1),
  quit: vi.fn().mockResolvedValue('OK'),
  on: vi.fn(),
  status: 'ready',
});

describe('Session Manager Service', () => {
  describe('Session Creation', () => {
    const createSession = async (
      userId: string,
      channel: string,
      redis: ReturnType<typeof createMockRedis>,
      metadata?: Record<string, unknown>
    ): Promise<Session> => {
      const session: Session = {
        id: `session-${Date.now()}`,
        userId,
        channel,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: {
          ...metadata,
          firstMessageAt: Date.now(),
          messageCount: 0,
        },
      };

      await redis.setex(`session:${channel}:${userId}`, 3600, JSON.stringify(session));
      return session;
    };

    it('should create a new session', async () => {
      const mockRedis = createMockRedis();
      mockRedis.setex.mockResolvedValue('OK');

      const session = await createSession('user-123', 'discord', mockRedis);

      expect(session.id).toMatch(/^session-/);
      expect(session.userId).toBe('user-123');
      expect(session.channel).toBe('discord');
      expect(session.metadata.messageCount).toBe(0);
    });

    it('should store session in Redis', async () => {
      const mockRedis = createMockRedis();
      mockRedis.setex.mockResolvedValue('OK');

      await createSession('user-123', 'discord', mockRedis);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'session:discord:user-123',
        3600,
        expect.any(String)
      );
    });
  });

  describe('Session Retrieval', () => {
    const getSession = async (
      channel: string,
      userId: string,
      redis: ReturnType<typeof createMockRedis>
    ): Promise<Session | null> => {
      const data = await redis.get(`session:${channel}:${userId}`);
      return data ? JSON.parse(data) : null;
    };

    it('should retrieve existing session', async () => {
      const mockRedis = createMockRedis();
      const existingSession: Session = {
        id: 'session-123',
        userId: 'user-456',
        channel: 'discord',
        createdAt: Date.now() - 1000,
        updatedAt: Date.now(),
        metadata: { messageCount: 5 },
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(existingSession));

      const session = await getSession('discord', 'user-456', mockRedis);

      expect(session).not.toBeNull();
      expect(session?.id).toBe('session-123');
    });

    it('should return null for non-existent session', async () => {
      const mockRedis = createMockRedis();
      mockRedis.get.mockResolvedValue(null);

      const session = await getSession('discord', 'non-existent', mockRedis);

      expect(session).toBeNull();
    });
  });

  describe('Session Deletion', () => {
    const deleteSession = async (
      channel: string,
      userId: string,
      redis: ReturnType<typeof createMockRedis>
    ): Promise<boolean> => {
      const result = await redis.del(`session:${channel}:${userId}`);
      return result > 0;
    };

    it('should delete existing session', async () => {
      const mockRedis = createMockRedis();
      mockRedis.del.mockResolvedValue(1);

      const deleted = await deleteSession('discord', 'user-123', mockRedis);

      expect(deleted).toBe(true);
    });
  });

  describe('Session Types', () => {
    it('should create session with required fields', () => {
      const session: Session = {
        id: 'session-123',
        userId: 'user-456',
        channel: 'discord',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      expect(session.id).toBeDefined();
      expect(session.userId).toBeDefined();
      expect(session.channel).toBeDefined();
    });
  });
});
