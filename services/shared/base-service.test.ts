/**
 * Base Service Tests
 * Tests for the shared base service functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BaseService, requestContext } from '../services/shared/base-service.js';

// Mock server for testing
const createMockServer = () => ({
  listen: vi.fn((port, cb) => {
    cb?.();
    return {};
  }),
  close: vi.fn((cb) => cb?.()),
  on: vi.fn(),
  address: () => ({ port: 18789 }),
  listening: true,
});

describe('BaseService', () => {
  let service: BaseService;
  const mockConfig = {
    serviceName: 'test-service',
    port: 3000,
    redisUrl: 'redis://localhost:6379',
    logLevel: 'error' as const,
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create a service with default config', () => {
      service = new (BaseService as any)(mockConfig);
      expect(service).toBeDefined();
      expect((service as any).config.serviceName).toBe('test-service');
    });

    it('should set default values for optional config', () => {
      service = new (BaseService as any)(mockConfig);
      const config = (service as any).config;
      expect(config.logLevel).toBe('error');
      expect(config.enableMetrics).toBe(true);
      expect(config.enableTracing).toBe(true);
      expect(config.gracefulShutdownTimeout).toBe(30000);
    });

    it('should initialize metrics object', () => {
      service = new (BaseService as any)(mockConfig);
      const metrics = (service as any).metrics;
      expect(metrics.service).toBe('test-service');
      expect(metrics.counters).toEqual({});
      expect(metrics.gauges).toEqual({});
      expect(metrics.histograms).toEqual({});
    });

    it('should register default health check', () => {
      service = new (BaseService as any)(mockConfig);
      const healthChecks = (service as any).healthChecks;
      expect(healthChecks.has('server')).toBe(true);
    });
  });

  describe('start', () => {
    it('should start the service and listen on port', async () => {
      service = new (BaseService as any)(mockConfig);
      
      const mockServer = createMockServer();
      vi.stubGlobal('createServer', () => mockServer);
      
      await service.start();
      
      expect(mockServer.listen).toHaveBeenCalledWith(
        mockConfig.port,
        expect.any(Function)
      );
    });

    it('should call initialize before starting server', async () => {
      service = new (BaseService as any)(mockConfig);
      
      const initializeSpy = vi.spyOn(service as any, 'initialize');
      const mockServer = createMockServer();
      vi.stubGlobal('createServer', () => mockServer);
      
      await service.start();
      
      expect(initializeSpy).toHaveBeenCalled();
    });
  });

  describe('stop', () => {
    it('should gracefully stop the service', async () => {
      service = new (BaseService as any)(mockConfig);
      
      const mockServer = createMockServer();
      vi.stubGlobal('createServer', () => mockServer);
      
      await service.start();
      await service.stop();
      
      expect(mockServer.close).toHaveBeenCalled();
    });

    it('should set isShuttingDown flag', async () => {
      service = new (BaseService as any)(mockConfig);
      
      const mockServer = createMockServer();
      vi.stubGlobal('createServer', () => mockServer);
      
      await service.start();
      expect((service as any).isShuttingDown).toBe(false);
      
      await service.stop();
      expect((service as any).isShuttingDown).toBe(true);
    });

    it('should call cleanup on stop', async () => {
      service = new (BaseService as any)(mockConfig);
      
      const cleanupSpy = vi.spyOn(service as any, 'cleanup');
      const mockServer = createMockServer();
      vi.stubGlobal('createServer', () => mockServer);
      
      await service.start();
      await service.stop();
      
      expect(cleanupSpy).toHaveBeenCalled();
    });

    it('should not stop twice', async () => {
      service = new (BaseService as any)(mockConfig);
      
      const mockServer = createMockServer();
      vi.stubGlobal('createServer', () => mockServer);
      
      await service.start();
      await service.stop();
      await service.stop(); // Second stop should be no-op
      
      expect(mockServer.close).toHaveBeenCalledTimes(1);
    });
  });

  describe('health checks', () => {
    it('should register custom health check', () => {
      service = new (BaseService as any)(mockConfig);
      
      const customCheck = async () => ({
        name: 'custom',
        status: 'pass' as const,
        timestamp: Date.now(),
      });
      
      service.registerHealthCheck('custom', customCheck);
      
      const healthChecks = (service as any).healthChecks;
      expect(healthChecks.has('custom')).toBe(true);
    });

    it('should get overall health status', () => {
      service = new (BaseService as any)(mockConfig);
      
      const healthStatus = service.getHealthStatus();
      
      expect(healthStatus.service).toBe('test-service');
      expect(healthStatus.status).toBeDefined();
      expect(healthStatus.checks).toBeInstanceOf(Array);
      expect(healthStatus.uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('metrics', () => {
    it('should increment counter', () => {
      service = new (BaseService as any)(mockConfig);
      
      service.incrementCounter('requests');
      service.incrementCounter('requests', 5);
      
      const metrics = (service as any).metrics;
      expect(metrics.counters.requests).toBe(6);
    });

    it('should set gauge value', () => {
      service = new (BaseService as any)(mockConfig);
      
      service.setGauge('active_connections', 42);
      
      const metrics = (service as any).metrics;
      expect(metrics.gauges.active_connections).toBe(42);
    });

    it('should observe histogram value', () => {
      service = new (BaseService as any)(mockConfig);
      
      service.observeHistogram('response_time', 0.5);
      
      const metrics = (service as any).metrics;
      expect(metrics.histograms.response_time).toBe(0.5);
    });
  });

  describe('HTTP handlers', () => {
    it('should handle health endpoint', async () => {
      service = new (BaseService as any)(mockConfig);
      
      const mockReq = { url: '/health', method: 'GET' };
      const mockRes = {
        writeHead: vi.fn(),
        end: vi.fn(),
      };
      
      // Access the handler through the service
      const handler = (service as any).getRequestHandler();
      handler(mockReq as any, mockRes as any);
      
      expect(mockRes.writeHead).toHaveBeenCalledWith(200, {
        'Content-Type': 'application/json',
      });
      expect(mockRes.end).toHaveBeenCalled();
    });

    it('should handle readiness endpoint', async () => {
      service = new (BaseService as any)(mockConfig);
      
      const mockReq = { url: '/ready', method: 'GET' };
      const mockRes = {
        writeHead: vi.fn(),
        end: vi.fn(),
      };
      
      const handler = (service as any).getRequestHandler();
      handler(mockReq as any, mockRes as any);
      
      expect(mockRes.writeHead).toHaveBeenCalledWith(200, {
        'Content-Type': 'application/json',
      });
    });

    it('should handle metrics endpoint', async () => {
      service = new (BaseService as any)(mockConfig);
      
      const mockReq = { url: '/metrics', method: 'GET' };
      const mockRes = {
        writeHead: vi.fn(),
        end: vi.fn(),
      };
      
      const handler = (service as any).getRequestHandler();
      handler(mockReq as any, mockRes as any);
      
      expect(mockRes.writeHead).toHaveBeenCalledWith(200, {
        'Content-Type': 'text/plain',
      });
      expect(mockRes.end).toHaveBeenCalled();
    });

    it('should return 404 for unknown routes', async () => {
      service = new (BaseService as any)(mockConfig);
      
      const mockReq = { url: '/unknown', method: 'GET' };
      const mockRes = {
        writeHead: vi.fn(),
        end: vi.fn(),
      };
      
      const handler = (service as any).getRequestHandler();
      handler(mockReq as any, mockRes as any);
      
      expect(mockRes.writeHead).toHaveBeenCalledWith(404);
    });

    it('should handle OPTIONS request for CORS', async () => {
      service = new (BaseService as any)(mockConfig);
      
      const mockReq = { url: '/health', method: 'OPTIONS' };
      const mockRes = {
        writeHead: vi.fn(),
        end: vi.fn(),
      };
      
      const handler = (service as any).getRequestHandler();
      handler(mockReq as any, mockRes as any);
      
      expect(mockRes.writeHead).toHaveBeenCalledWith(204);
      expect(mockRes.end).toHaveBeenCalled();
    });
  });

  describe('signal handling', () => {
    it('should setup SIGTERM handler', () => {
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as any);
      
      service = new (BaseService as any)(mockConfig);
      
      const mockServer = createMockServer();
      vi.stubGlobal('createServer', () => mockServer);
      
      // Simulate SIGTERM
      process.emit('SIGTERM');
      
      vi.runAllTimers();
      
      // Should have called stop which calls server.close
      expect(mockServer.close).toHaveBeenCalled();
      
      mockExit.mockRestore();
    });

    it('should setup SIGINT handler', () => {
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as any);
      
      service = new (BaseService as any)(mockConfig);
      
      const mockServer = createMockServer();
      vi.stubGlobal('createServer', () => mockServer);
      
      process.emit('SIGINT');
      
      vi.runAllTimers();
      
      expect(mockServer.close).toHaveBeenCalled();
      
      mockExit.mockRestore();
    });

    it('should handle uncaught exceptions', () => {
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as any);
      
      service = new (BaseService as any)(mockConfig);
      
      process.emit('uncaughtException', new Error('Test error'));
      
      expect(mockExit).toHaveBeenCalledWith(1);
      
      mockExit.mockRestore();
    });
  });

  describe('request context', () => {
    it('should provide async local storage', () => {
      expect(requestContext).toBeDefined();
      expect(typeof requestContext.run).toBe('function');
    });

    it('should run code within context', () => {
      const result = requestContext.run(new Map([['key', 'value']]), () => {
        return requestContext.getStore()?.get('key');
      });
      
      expect(result).toBe('value');
    });
  });
});

describe('BaseService subclasses', () => {
  class TestService extends BaseService {
    async initialize() {
      // Custom initialization
    }

    async cleanup() {
      // Custom cleanup
    }

    setupRoutes() {
      // Custom routes
    }
  }

  it('should allow subclassing', () => {
    const service = new TestService({
      serviceName: 'test',
      port: 3000,
      redisUrl: 'redis://localhost:6379',
    });

    expect(service).toBeInstanceOf(BaseService);
    expect(service).toBeInstanceOf(TestService);
  });
});
