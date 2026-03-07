export type ChannelConnectionStatus = "pending" | "verified" | "failed";

export type InviteRecord = {
  token: string;
  email: string;
  tenantHint: string;
  usedAt?: string;
};

export type UserRecord = {
  userId: string;
  email: string;
  displayName: string;
  signupMode: "self-serve" | "invite";
  createdAt: string;
};

export type TenantBootstrapRecord = {
  tenantId: string;
  workspaceId: string;
  ownerUserId: string;
  profile: "starter" | "regulated";
  createdAt: string;
};

export type WizardStateRecord = {
  userId: string;
  stage: "account" | "channels" | "skills" | "complete";
  completedSteps: string[];
  updatedAt: string;
};

export type ChannelCatalogItem = {
  channelId: string;
  authMode: "oauth" | "token" | "qr" | "password";
  setupType: "direct" | "bot" | "bridge";
  supportsInChannelSetup: boolean;
};

export type ChannelConnectionRecord = {
  connectionId: string;
  userId: string;
  channelId: string;
  accountLabel: string;
  status: ChannelConnectionStatus;
  createdAt: string;
  verifiedAt?: string;
};

export type SkillCatalogItem = {
  skillKey: string;
  title: string;
  source: "clawhub" | "bundled";
  missingRequirements: string[];
};

export type SkillInstallRecord = {
  installId: string;
  userId: string;
  skillKey: string;
  status: "started" | "completed" | "failed";
  reason?: string;
  createdAt: string;
  completedAt?: string;
};

export type SkillConfigRecord = {
  userId: string;
  skillKey: string;
  enabled: boolean;
  env: Record<string, string>;
  updatedAt: string;
};

export type SetupCompletionRecord = {
  userId: string;
  tenantId: string;
  workspaceId: string;
  completedAt: string;
};

export type OnboardingEvent = {
  eventType:
    | "onboarding.user.created"
    | "onboarding.tenant.bootstrapped"
    | "channel.connection.created"
    | "channel.connection.verified"
    | "channel.connection.failed"
    | "skill.install.started"
    | "skill.install.completed"
    | "skill.install.failed"
    | "setup.completed";
  occurredAt: string;
  payload: Record<string, unknown>;
};

export type OnboardingServiceConfig = {
  port: number;
  defaultWorkspace: string;
};
