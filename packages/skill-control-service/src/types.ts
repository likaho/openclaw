export type SkillRuntime = "node" | "python";
export type RolloutStage = "dev" | "canary" | "general";

export type SkillArtifact = {
  tenantId: string;
  skillId: string;
  version: string;
  runtime: SkillRuntime;
  capabilityProfile: string;
  artifactDigest: string;
  sbomDigest?: string;
  signature: string;
  admitted: boolean;
  admittedReason: string;
  createdAt: string;
};

export type TenantSkillPolicy = {
  tenantId: string;
  allowedRuntimes: SkillRuntime[];
  allowedCapabilities: string[];
  trustedSkillIds: string[];
};

export type RolloutRecord = {
  tenantId: string;
  skillId: string;
  version: string;
  stage: RolloutStage;
  canaryPercent?: number;
  createdAt: string;
};
