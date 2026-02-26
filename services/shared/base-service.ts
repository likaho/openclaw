/**
 * OpenClaw Service Base Class
 * 
 * Provides common functionality for all microservices:
 * - Health checks
 * - Metrics collection
 * - Logging
 * - Signal handling
 * - Graceful shutdown
 */

import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { AsyncLocalStorage } from 'node:async_hooks';
import { createLogger, type Logger } from 'node:logging';
import type { 
  ServiceConfig, 
  HealthStatus, 
  HealthCheck,
  ServiceMetrics 
} from './interfaces.js';

// Request context for tracing
export const requestContext = new AsyncLocalStorage<Map<string, unknown>>();

/**
 * Base service configuration
 */
export interface BaseServiceConfig {
  serviceName: string;
  port: number;
  redisUrl: string;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  enableMetrics?: boolean;
  enableTracing?: boolean;
  gracefulShutdownTimeout?: number;
}

/**
 * Abstract base class for all OpenClaw services
 */
export abstract class BaseService {
  protected config: BaseServiceConfig;
  protected logger: Logger;
  protected server: Server | null = null;
  protected isShuttingDown = false;
  protected startTime: number;
  protected metrics: ServiceMetrics;
  
  // Health check handlers
  protected healthChecks: Map<string, () => Promise<HealthCheck>> = new Map();
  
  // Message queue subscribers
  protected messageHandlers: Map<string, (message: unknown) => void> = new Map();

  constructor(config: BaseServiceConfig) {
    this.config = {
      logLevel: 'info',
      enableMetrics: true,
      enableTracing: true,
      gracefulShutdownTimeout: 30000,
      ...config,
    };
    
    this.startTime = Date.now();
    this.logger = createLogger({
      name: this.config.serviceName,
      level: this.config.logLevel,
      format: 'json',
    });
    
    this.metrics = {
      service: this.config.serviceName,
      timestamp: Date.now(),
      counters: {},
      gauges: {},
      histograms: {},
    };
    
    // Register default health check
    this.registerHealthCheck('server', async () => this.checkServerHealth());
    
    // Setup signal handlers
    this.setupSignalHandlers();
  }

  /**
   * Start the service
   */
  async start(): Promise<void> {
    this.logger.info(`${this.config.serviceName} starting...`);
    
    // Initialize connections (override in subclass)
    await this.initialize();
    
    // Create HTTP server
    this.server = createServer(this.getRequestHandler());
    
    // Setup routes
    this.setupRoutes();
    
    // Start listening
    await new Promise<void>((resolve, reject) => {
      if (!this.server) {
        reject(new Error('Server not initialized'));
        return;
      }
      
      this.server.on('error', (err) => {
        this.logger.error('Server error', { error: err.message });
        reject(err);
      });
      
      this.server.listen(this.config.port, () => {
        const address = this.server?.address() as AddressInfo;
        this.logger.info(`${this.config.serviceName} listening on port ${address.port}`);
        resolve();
      });
    });
    
    // Start metrics collection
    if (this.config.enableMetrics) {
      this.startMetricsCollection();
    }
    
    this.logger.info(`${this.config.serviceName} started successfully`);
  }

  /**
   * Stop the service gracefully
   */
  async stop(): Promise<void> {
    if (this.isShuttingDown) {
      this.logger.warn('Already shutting down');
      return;
    }
    
    this.isShuttingDown = true;
    this.logger.info(`${this.config.serviceName} shutting down...`);
    
    // Stop accepting new connections
    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server?.close(() => {
          this.logger.info('HTTP server closed');
          resolve();
        });
      });
    }
    
    // Cleanup (override in subclass)
    await this.cleanup();
    
    this.logger.info(`${this.config.serviceName} stopped`);
  }

  /**
   * Get the HTTP request handler
   */
  protected getRequestHandler(): (req: NodeJS.HttpRequest, res: NodeJS.HttpResponse) => void {
    return (req, res) => {
      const url = req.url || '';
      
      // CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      
      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }
      
      // Health endpoint
      if (url === '/health' || url === '/healthz') {
        this.handleHealth(res);
        return;
      }
      
      // Readiness endpoint
      if (url === '/ready') {
        this.handleReadiness(res);
        return;
      }
      
      // Metrics endpoint
      if (url === '/metrics' && this.config.enableMetrics) {
        this.handleMetrics(res);
        return;
      }
      
      // Service-specific routes (override in subclass)
      this.handleRoute(req, res);
    };
  }

  /**
   * Handle service-specific routes
   */
  protected handleRoute(req: NodeJS.HttpRequest, res: NodeJS.HttpResponse): void {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
  }

  /**
   * Setup additional routes (override in subclass)
   */
  protected setupRoutes(): void {
    // Override in subclass to add custom routes
  }

  /**
   * Initialize service (override in subclass)
   */
  protected async initialize(): Promise<void> {
    // Override in subclass
  }

  /**
   * Cleanup on shutdown (override in subclass)
   */
  protected async cleanup(): Promise<void> {
    // Override in subclass
  }

  /**
   * Health check handler
   */
  private handleHealth(res: NodeJS.HttpResponse): void {
    const status = this.getHealthStatus();
    const statusCode = status.status === 'healthy' ? 200 : 
                      status.status === 'degraded' ? 200 : 503;
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(status));
  }

  /**
   * Readiness check handler
   */
  private handleReadiness(res: NodeJS.HttpResponse): void {
    // Check if ready to accept traffic
    const isReady = !this.isShuttingDown && this.server?.listening;
    res.writeHead(isReady ? 200 : 503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ready: isReady }));
  }

  /**
   * Metrics handler
   */
  private handleMetrics(res: NodeJS.HttpResponse): void {
    // Prometheus format metrics
    const lines: string[] = [
      `# HELP openclaw_service_info OpenClaw service information`,
      `# TYPE openclaw_service_info gauge`,
      `openclaw_service_info{service="${this.config.serviceName}",version="${process.env.APP_VERSION || 'unknown'}"} 1`,
      ``,
      `# HELP openclaw_uptime_seconds Service uptime in seconds`,
      `# TYPE openclaw_uptime_seconds gauge`,
      `openclaw_uptime_seconds{service="${this.config.serviceName}"} ${Math.floor((Date.now() - this.startTime) / 1000)}`,
    ];
    
    // Add custom counters
    for (const [name, value] of Object.entries(this.metrics.counters)) {
      lines.push(
        `# HELP openclaw_${name} Custom counter`,
        `# TYPE openclaw_${name} counter`,
        `openclaw_${name}{service="${this.config.serviceName}"} ${value}`,
      );
    }
    
    // Add custom gauges
    for (const [name, value] of Object.entries(this.metrics.gauges)) {
      lines.push(
        `# HELP openclaw_${name} Custom gauge`,
        `# TYPE openclaw_${name} gauge`,
        `openclaw_${name}{service="${this.config.serviceName}"} ${value}`,
      );
    }
    
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(lines.join('\n'));
  }

  /**
   * Get overall health status
   */
  protected getHealthStatus(): HealthStatus {
    const checks: HealthCheck[] = [];
    let overallStatus: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
    
    for (const [name, checkFn] of this.healthChecks) {
      try {
        const check = checkFn();
        if (check instanceof Promise) {
          // Will be resolved later
        }
        checks.push({ name, status: 'pass', timestamp: Date.now() });
      } catch {
        checks.push({ name, status: 'fail', timestamp: Date.now() });
        overallStatus = 'unhealthy';
      }
    }
    
    return {
      status: overallStatus,
      service: this.config.serviceName,
      version: process.env.APP_VERSION || 'unknown',
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      checks,
    };
  }

  /**
   * Check server health
   */
  private checkServerHealth(): HealthCheck {
    return {
      name: 'server',
      status: this.server?.listening ? 'pass' : 'fail',
      timestamp: Date.now(),
    };
  }

  /**
   * Register a health check
   */
  protected registerHealthCheck(name: string, checkFn: () => Promise<HealthCheck>): void {
    this.healthChecks.set(name, checkFn);
  }

  /**
   * Increment a counter metric
   */
  protected incrementCounter(name: string, value = 1): void {
    this.metrics.counters[name] = (this.metrics.counters[name] || 0) + value;
  }

  /**
   * Set a gauge metric
   */
  protected setGauge(name: string, value: number): void {
    this.metrics.gauges[name] = value;
  }

  /**
   * Observe a histogram value
   */
  protected observeHistogram(name: string, value: number): void {
    if (!this.metrics.histograms[name]) {
      this.metrics.histograms[name] = 0;
    }
    this.metrics.histograms[name] = value;
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    setInterval(() => {
      this.metrics.timestamp = Date.now();
    }, 10000);
  }

  /**
   * Setup signal handlers for graceful shutdown
   */
  private setupSignalHandlers(): void {
    const shutdown = async (signal: string) => {
      this.logger.info(`Received ${signal}, starting graceful shutdown`);
      
      setTimeout(() => {
        this.logger.error('Graceful shutdown timeout, forcing exit');
        process.exit(1);
      }, this.config.gracefulShutdownTimeout);
      
      await this.stop();
      process.exit(0);
    };
    
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    
    process.on('uncaughtException', (err) => {
      this.logger.error('Uncaught exception', { error: err.message, stack: err.stack });
      process.exit(1);
    });
    
    process.on('unhandledRejection', (reason) => {
      this.logger.error('Unhandled rejection', { reason: String(reason) });
    });
  }
}

export default BaseService;
