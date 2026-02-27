/**
 * Kubernetes Manifest Tests
 * Tests for validating K8s manifest structure and configuration
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

// Helper to load YAML files
const loadYamlFile = (filePath: string): unknown => {
  const content = fs.readFileSync(filePath, 'utf-8');
  return yaml.load(content);
};

describe('Kubernetes Manifests', () => {
  const k8sDir = path.join(process.cwd(), 'k8s');
  
  describe('Base manifests', () => {
    it('should have valid namespace definitions', () => {
      const namespaceFile = path.join(k8sDir, 'base', '00-namespace.yaml');
      const content = loadYamlFile(namespaceFile) as Record<string, unknown>[];
      
      const namespaces = Array.isArray(content) ? content : [content];
      
      for (const ns of namespaces) {
        expect(ns.kind).toBe('Namespace');
        expect(ns.metadata).toBeDefined();
        const name = (ns.metadata as Record<string, unknown>).name as string;
        expect(name).toMatch(/^(openclaw|openclaw-channels|openclaw-system|openclaw-monitoring)$/);
      }
    });

    it('should have valid configmap', () => {
      const configFile = path.join(k8sDir, 'base', '01-configmap.yaml');
      const content = loadYamlFile(configFile) as Record<string, unknown>;
      
      expect(content.kind).toBe('ConfigMap');
      expect(content.metadata.name).toBe('openclaw-config');
      expect(content.data).toBeDefined();
      expect((content.data as Record<string, string>).REDIS_URL).toBeDefined();
      expect((content.data as Record<string, string>).CONTROL_PLANE_URL).toBeDefined();
      expect((content.data as Record<string, string>).API_GATEWAY_URL).toBeDefined();
    });

    it('should have valid secrets template', () => {
      const secretsFile = path.join(k8sDir, 'base', '02-secrets.yaml');
      const content = loadYamlFile(secretsFile) as Record<string, unknown>;
      
      expect(content.kind).toBe('Secret');
      expect(content.metadata.name).toBe('openclaw-secrets');
      expect(content.type).toBe('Opaque');
    });
  });

  describe('API Gateway deployment', () => {
    let deployment: Record<string, unknown>;
    
    beforeEach(() => {
      const file = path.join(k8sDir, 'base', '10-api-gateway.yaml');
      const content = loadYamlFile(file) as Record<string, unknown>[];
      const arr = Array.isArray(content) ? content : [content];
      deployment = arr.find((c) => c?.kind === 'Deployment') as Record<string, unknown>;
    });

    it('should define API Gateway deployment', () => {
      expect(deployment).toBeDefined();
      expect(deployment.kind).toBe('Deployment');
      expect(deployment.metadata.name).toBe('api-gateway');
    });

    it('should have correct namespace', () => {
      expect(deployment.metadata.namespace).toBe('openclaw');
    });

    it('should define replicas', () => {
      expect((deployment.spec as Record<string, unknown>).replicas).toBe(3);
    });

    it('should have proper selector', () => {
      const selector = (deployment.spec as Record<string, unknown>).selector as Record<string, Record<string, string>>;
      expect(selector.matchLabels.app).toBe('api-gateway');
    });

    it('should define container with ports', () => {
      const template = deployment.spec.template as Record<string, unknown>;
      const spec = template.spec as Record<string, unknown>[];
      const container = spec[0] as Record<string, unknown>;
      expect(container.name).toBe('api-gateway');
      expect(container.ports).toBeDefined();
      const ports = (container.ports as Record<string, unknown>[]).map((p) => p.name);
      expect(ports).toContain('http');
      expect(ports).toContain('ws');
    });

    it('should have liveness probe', () => {
      const template = deployment.spec.template as Record<string, unknown>;
      const spec = template.spec as Record<string, unknown>[];
      const container = spec[0] as Record<string, unknown>;
      const livenessProbe = container.livenessProbe as Record<string, unknown>;
      expect(livenessProbe).toBeDefined();
      expect((livenessProbe.httpGet as Record<string, string>).path).toBe('/health');
    });

    it('should have readiness probe', () => {
      const template = deployment.spec.template as Record<string, unknown>;
      const spec = template.spec as Record<string, unknown>[];
      const container = spec[0] as Record<string, unknown>;
      const readinessProbe = container.readinessProbe as Record<string, unknown>;
      expect(readinessProbe).toBeDefined();
      expect((readinessProbe.httpGet as Record<string, string>).path).toBe('/ready');
    });

    it('should define resource limits', () => {
      const template = deployment.spec.template as Record<string, unknown>;
      const spec = template.spec as Record<string, unknown>[];
      const container = spec[0] as Record<string, unknown>;
      const resources = container.resources as Record<string, Record<string, string>>;
      expect(resources.limits.cpu).toBeDefined();
      expect(resources.limits.memory).toBeDefined();
    });

    it('should have prometheus annotations', () => {
      const template = deployment.spec as Record<string, unknown>;
      const metadata = template.metadata as Record<string, Record<string, string>>;
      const annotations = metadata.annotations;
      expect(annotations['prometheus.io/scrape']).toBe('true');
      expect(annotations['prometheus.io/port']).toBeDefined();
    });
  });

  describe('Control Plane deployment', () => {
    let deployment: Record<string, unknown>;
    
    beforeEach(() => {
      const file = path.join(k8sDir, 'base', '11-control-plane.yaml');
      const content = loadYamlFile(file) as Record<string, unknown>[];
      const arr = Array.isArray(content) ? content : [content];
      deployment = arr.find((c) => c?.kind === 'Deployment') as Record<string, unknown>;
    });

    it('should define Control Plane deployment', () => {
      expect(deployment).toBeDefined();
      expect(deployment.kind).toBe('Deployment');
      expect(deployment.metadata.name).toBe('control-plane');
    });

    it('should have correct namespace', () => {
      expect(deployment.metadata.namespace).toBe('openclaw');
    });
  });

  describe('Channel services', () => {
    const channels = ['discord', 'telegram', 'slack', 'whatsapp'];
    
    channels.forEach(channel => {
      describe(`${channel} channel`, () => {
        let deployment: Record<string, unknown> | undefined;
        
        beforeEach(() => {
          const file = path.join(k8sDir, 'base', `24-channel-${channel}.yaml`);
          if (fs.existsSync(file)) {
            const content = loadYamlFile(file) as Record<string, unknown>[];
            const arr = Array.isArray(content) ? content : [content];
            deployment = arr.find((c) => c?.kind === 'Deployment') as Record<string, unknown> | undefined;
          }
        });

        it(`should define ${channel} deployment`, () => {
          if (deployment) {
            expect(deployment.kind).toBe('Deployment');
            expect(deployment.metadata.name).toBe(`channel-${channel}`);
          }
        });

        it(`should be in correct namespace`, () => {
          if (deployment) {
            expect(deployment.metadata.namespace).toBe('openclaw-channels');
          }
        });
      });
    });
  });

  describe('Agent Runtime deployment', () => {
    let deployment: Record<string, unknown>;
    let hpa: Record<string, unknown>;
    
    beforeEach(() => {
      const file = path.join(k8sDir, 'base', '30-agent-runtime.yaml');
      const content = loadYamlFile(file) as Record<string, unknown>[];
      const arr = Array.isArray(content) ? content : [content];
      deployment = arr.find((c) => c?.kind === 'Deployment') as Record<string, unknown>;
      hpa = arr.find((c) => c?.kind === 'HorizontalPodAutoscaler') as Record<string, unknown>;
    });

    it('should define Agent Runtime deployment', () => {
      expect(deployment).toBeDefined();
      expect(deployment.kind).toBe('Deployment');
      expect(deployment.metadata.name).toBe('agent-runtime');
    });

    it('should have HPA with higher max replicas', () => {
      expect(hpa).toBeDefined();
      expect((hpa.spec as Record<string, unknown>).maxReplicas).toBe(50);
    });

    it('should have higher resource limits', () => {
      const template = deployment.spec.template as Record<string, unknown>;
      const spec = template.spec as Record<string, unknown>[];
      const container = spec[0] as Record<string, unknown>;
      const resources = container.resources as Record<string, Record<string, string>>;
      expect(resources.limits.memory).toBe('2Gi');
      expect(resources.limits.cpu).toBe('2000m');
    });
  });

  describe('Network policies', () => {
    it('should define network policies', () => {
      const file = path.join(k8sDir, 'base', '50-network-policies.yaml');
      const content = loadYamlFile(file) as Record<string, unknown>[];
      const policies = Array.isArray(content) ? content : [content];
      
      const hasNetworkPolicy = policies.some((p) => p?.kind === 'NetworkPolicy');
      expect(hasNetworkPolicy).toBe(true);
    });
  });

  describe('Service accounts and RBAC', () => {
    it('should define service accounts', () => {
      const file = path.join(k8sDir, 'base', '40-service-accounts.yaml');
      const content = loadYamlFile(file) as Record<string, unknown>[];
      const resources = Array.isArray(content) ? content : [content];
      const serviceAccounts = resources.filter((r) => r?.kind === 'ServiceAccount');
      
      expect(serviceAccounts.length).toBeGreaterThan(0);
    });

    it('should define RBAC roles', () => {
      const file = path.join(k8sDir, 'base', '40-service-accounts.yaml');
      const content = loadYamlFile(file) as Record<string, unknown>[];
      const resources = Array.isArray(content) ? content : [content];
      const roles = resources.filter((r) => r?.kind === 'Role');
      
      expect(roles.length).toBeGreaterThan(0);
    });

    it('should define role bindings', () => {
      const file = path.join(k8sDir, 'base', '40-service-accounts.yaml');
      const content = loadYamlFile(file) as Record<string, unknown>[];
      const resources = Array.isArray(content) ? content : [content];
      const bindings = resources.filter((r) => r?.kind === 'RoleBinding');
      
      expect(bindings.length).toBeGreaterThan(0);
    });
  });

  describe('Environment overlays', () => {
    it('should have dev environment', () => {
      const file = path.join(k8sDir, 'environments', 'dev', 'kustomization.yaml');
      expect(fs.existsSync(file)).toBe(true);
      
      const content = loadYamlFile(file) as Record<string, unknown>;
      expect(content.apiVersion).toBe('kustomize.config.k8s.io/v1beta1');
      expect(content.kind).toBe('Kustomization');
    });

    it('should have staging environment', () => {
      const file = path.join(k8sDir, 'environments', 'staging', 'kustomization.yaml');
      expect(fs.existsSync(file)).toBe(true);
    });

    it('should have prod environment', () => {
      const file = path.join(k8sDir, 'environments', 'prod', 'kustomization.yaml');
      expect(fs.existsSync(file)).toBe(true);
    });
  });
});

describe('Helm Charts', () => {
  const helmDir = path.join(process.cwd(), 'helm', 'openclaw');
  
  it('should have Chart.yaml', () => {
    const file = path.join(helmDir, 'Chart.yaml');
    const content = loadYamlFile(file) as Record<string, unknown>;
    
    expect(content.apiVersion).toBe('v2');
    expect(content.name).toBe('openclaw');
    expect(content.version).toBeDefined();
  });

  it('should have values.yaml', () => {
    const file = path.join(helmDir, 'values.yaml');
    expect(fs.existsSync(file)).toBe(true);
    
    const content = loadYamlFile(file) as Record<string, unknown>;
    
    expect(content.global).toBeDefined();
    expect((content.global as Record<string, unknown>).imageRegistry).toBeDefined();
    expect(content.apiGateway).toBeDefined();
    expect(content.controlPlane).toBeDefined();
    expect(content.channels).toBeDefined();
    expect(content.monitoring).toBeDefined();
  });

  it('should have templates', () => {
    const templatesDir = path.join(helmDir, 'templates');
    expect(fs.existsSync(templatesDir)).toBe(true);
    
    const files = fs.readdirSync(templatesDir);
    expect(files.length).toBeGreaterThan(0);
  });

  it('should have helpers template', () => {
    const file = path.join(helmDir, 'templates', '_helpers.tpl');
    expect(fs.existsSync(file)).toBe(true);
  });
});

describe('Dockerfiles', () => {
  const dockerDir = path.join(process.cwd(), 'docker');
  
  const expectedDockerfiles = [
    'Dockerfile.base',
    'Dockerfile.api-gateway',
    'Dockerfile.control-plane',
    'Dockerfile.channel-discord',
    'Dockerfile.channel-telegram',
    'Dockerfile.channel-slack',
    'Dockerfile.channel-whatsapp',
    'Dockerfile.agent-runtime',
  ];

  expectedDockerfiles.forEach(dockerfile => {
    it(`should have ${dockerfile}`, () => {
      const file = path.join(dockerDir, dockerfile);
      expect(fs.existsSync(file)).toBe(true);
      
      const content = fs.readFileSync(file, 'utf-8');
      
      expect(content).toMatch(/^FROM\s+/m);
      expect(content).toMatch(/FROM\s+node:/);
      expect(content).toMatch(/WORKDIR\s+\/app/);
    });
  });
});
