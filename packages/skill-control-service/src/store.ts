import type { RolloutRecord, SkillArtifact, TenantSkillPolicy } from "./types.js";

export type SkillControlStore = {
  setTenantPolicy: (policy: TenantSkillPolicy) => TenantSkillPolicy;
  getTenantPolicy: (tenantId: string) => TenantSkillPolicy | undefined;
  saveArtifact: (artifact: SkillArtifact) => SkillArtifact;
  getArtifact: (tenantId: string, skillId: string, version: string) => SkillArtifact | undefined;
  saveRollout: (rollout: RolloutRecord) => RolloutRecord;
  listRollouts: (tenantId: string, skillId: string) => RolloutRecord[];
};

const artifactKey = (tenantId: string, skillId: string, version: string): string =>
  `${tenantId}:${skillId}:${version}`;

export const createInMemorySkillControlStore = (): SkillControlStore => {
  const policies = new Map<string, TenantSkillPolicy>();
  const artifacts = new Map<string, SkillArtifact>();
  const rollouts = new Map<string, RolloutRecord[]>();

  return {
    setTenantPolicy: (policy) => {
      const copy: TenantSkillPolicy = {
        tenantId: policy.tenantId,
        allowedRuntimes: [...policy.allowedRuntimes],
        allowedCapabilities: [...policy.allowedCapabilities],
        trustedSkillIds: [...policy.trustedSkillIds],
      };
      policies.set(copy.tenantId, copy);
      return copy;
    },
    getTenantPolicy: (tenantId) => policies.get(tenantId),
    saveArtifact: (artifact) => {
      artifacts.set(artifactKey(artifact.tenantId, artifact.skillId, artifact.version), artifact);
      return artifact;
    },
    getArtifact: (tenantId, skillId, version) =>
      artifacts.get(artifactKey(tenantId, skillId, version)),
    saveRollout: (rollout) => {
      const key = `${rollout.tenantId}:${rollout.skillId}`;
      const existing = rollouts.get(key) ?? [];
      const next = [rollout, ...existing].slice(0, 100);
      rollouts.set(key, next);
      return rollout;
    },
    listRollouts: (tenantId, skillId) => rollouts.get(`${tenantId}:${skillId}`) ?? [],
  };
};
