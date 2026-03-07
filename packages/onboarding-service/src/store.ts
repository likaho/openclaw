import { randomUUID } from "node:crypto";
import type {
  ChannelCatalogItem,
  ChannelConnectionRecord,
  InviteRecord,
  OnboardingEvent,
  SetupCompletionRecord,
  SkillCatalogItem,
  SkillConfigRecord,
  SkillInstallRecord,
  TenantBootstrapRecord,
  UserRecord,
  WizardStateRecord,
} from "./types.js";

const CHANNEL_CATALOG: ChannelCatalogItem[] = [
  { channelId: "whatsapp", authMode: "qr", setupType: "direct", supportsInChannelSetup: true },
  { channelId: "telegram", authMode: "token", setupType: "bot", supportsInChannelSetup: true },
  { channelId: "slack", authMode: "oauth", setupType: "bot", supportsInChannelSetup: true },
  { channelId: "discord", authMode: "token", setupType: "bot", supportsInChannelSetup: true },
  { channelId: "signal", authMode: "qr", setupType: "bridge", supportsInChannelSetup: false },
  {
    channelId: "imessage",
    authMode: "password",
    setupType: "bridge",
    supportsInChannelSetup: false,
  },
  { channelId: "googlechat", authMode: "oauth", setupType: "bot", supportsInChannelSetup: false },
  { channelId: "matrix", authMode: "password", setupType: "bridge", supportsInChannelSetup: false },
  { channelId: "mattermost", authMode: "token", setupType: "bot", supportsInChannelSetup: false },
  { channelId: "msteams", authMode: "oauth", setupType: "bot", supportsInChannelSetup: false },
];

const SKILL_CATALOG: SkillCatalogItem[] = [
  { skillKey: "calendar", title: "Calendar Assistant", source: "clawhub", missingRequirements: [] },
  {
    skillKey: "homeassistant",
    title: "Home Assistant",
    source: "clawhub",
    missingRequirements: ["HOME_ASSISTANT_TOKEN"],
  },
  { skillKey: "summarize", title: "Summarize", source: "bundled", missingRequirements: [] },
];

export type OnboardingStore = {
  createInvite: (email: string, tenantHint: string) => InviteRecord;
  acceptInvite: (token: string) => InviteRecord | undefined;
  createUser: (
    email: string,
    displayName: string,
    signupMode: UserRecord["signupMode"],
  ) => UserRecord;
  getUser: (userId: string) => UserRecord | undefined;
  createTenantBootstrap: (
    tenantId: string,
    workspaceId: string,
    ownerUserId: string,
    profile: TenantBootstrapRecord["profile"],
  ) => TenantBootstrapRecord;
  getTenantBootstrap: (tenantId: string) => TenantBootstrapRecord | undefined;
  setWizardState: (state: WizardStateRecord) => WizardStateRecord;
  getWizardState: (userId: string) => WizardStateRecord | undefined;
  listChannels: () => ChannelCatalogItem[];
  createChannelConnection: (
    userId: string,
    channelId: string,
    accountLabel: string,
  ) => ChannelConnectionRecord | undefined;
  verifyChannelConnection: (
    connectionId: string,
    ok: boolean,
  ) => ChannelConnectionRecord | undefined;
  listSkills: () => SkillCatalogItem[];
  installSkill: (userId: string, skillKey: string) => SkillInstallRecord;
  configureSkill: (
    userId: string,
    skillKey: string,
    enabled: boolean,
    env: Record<string, string>,
  ) => SkillConfigRecord;
  completeSetup: (userId: string, tenantId: string, workspaceId: string) => SetupCompletionRecord;
  listEvents: () => OnboardingEvent[];
};

export const createInMemoryOnboardingStore = (): OnboardingStore => {
  const invites = new Map<string, InviteRecord>();
  const users = new Map<string, UserRecord>();
  const tenantBootstraps = new Map<string, TenantBootstrapRecord>();
  const wizardStates = new Map<string, WizardStateRecord>();
  const channelConnections = new Map<string, ChannelConnectionRecord>();
  const skillConfigs = new Map<string, SkillConfigRecord>();
  const setupCompletions = new Map<string, SetupCompletionRecord>();
  const events: OnboardingEvent[] = [];

  const emit = (
    eventType: OnboardingEvent["eventType"],
    payload: Record<string, unknown>,
  ): void => {
    events.push({ eventType, occurredAt: new Date().toISOString(), payload: { ...payload } });
  };

  return {
    createInvite: (email, tenantHint) => {
      const invite: InviteRecord = { token: randomUUID(), email, tenantHint };
      invites.set(invite.token, invite);
      return { ...invite };
    },

    acceptInvite: (token) => {
      const invite = invites.get(token);
      if (!invite || invite.usedAt) {
        return undefined;
      }
      const next = { ...invite, usedAt: new Date().toISOString() };
      invites.set(token, next);
      return next;
    },

    createUser: (email, displayName, signupMode) => {
      const user: UserRecord = {
        userId: randomUUID(),
        email,
        displayName,
        signupMode,
        createdAt: new Date().toISOString(),
      };
      users.set(user.userId, user);
      emit("onboarding.user.created", { userId: user.userId, signupMode, email });
      return { ...user };
    },

    getUser: (userId) => users.get(userId),

    createTenantBootstrap: (tenantId, workspaceId, ownerUserId, profile) => {
      const existing = tenantBootstraps.get(tenantId);
      if (existing) {
        return { ...existing };
      }
      const bootstrap: TenantBootstrapRecord = {
        tenantId,
        workspaceId,
        ownerUserId,
        profile,
        createdAt: new Date().toISOString(),
      };
      tenantBootstraps.set(tenantId, bootstrap);
      emit("onboarding.tenant.bootstrapped", { tenantId, workspaceId, ownerUserId, profile });
      return { ...bootstrap };
    },

    getTenantBootstrap: (tenantId) => tenantBootstraps.get(tenantId),

    setWizardState: (state) => {
      const next = {
        ...state,
        completedSteps: [...state.completedSteps],
        updatedAt: new Date().toISOString(),
      };
      wizardStates.set(state.userId, next);
      return next;
    },

    getWizardState: (userId) => wizardStates.get(userId),

    listChannels: () => CHANNEL_CATALOG.map((entry) => ({ ...entry })),

    createChannelConnection: (userId, channelId, accountLabel) => {
      if (!CHANNEL_CATALOG.some((entry) => entry.channelId === channelId)) {
        return undefined;
      }
      const connection: ChannelConnectionRecord = {
        connectionId: randomUUID(),
        userId,
        channelId,
        accountLabel,
        status: "pending",
        createdAt: new Date().toISOString(),
      };
      channelConnections.set(connection.connectionId, connection);
      emit("channel.connection.created", {
        connectionId: connection.connectionId,
        userId,
        channelId,
      });
      return { ...connection };
    },

    verifyChannelConnection: (connectionId, ok) => {
      const current = channelConnections.get(connectionId);
      if (!current) {
        return undefined;
      }
      const next: ChannelConnectionRecord = {
        ...current,
        status: ok ? "verified" : "failed",
        verifiedAt: new Date().toISOString(),
      };
      channelConnections.set(connectionId, next);
      emit(ok ? "channel.connection.verified" : "channel.connection.failed", {
        connectionId,
        channelId: next.channelId,
        userId: next.userId,
      });
      return { ...next };
    },

    listSkills: () =>
      SKILL_CATALOG.map((entry) => ({
        ...entry,
        missingRequirements: [...entry.missingRequirements],
      })),

    installSkill: (userId, skillKey) => {
      const skill = SKILL_CATALOG.find((entry) => entry.skillKey === skillKey);
      if (!skill) {
        const failed: SkillInstallRecord = {
          installId: randomUUID(),
          userId,
          skillKey,
          status: "failed",
          reason: "skill_not_found",
          createdAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        };
        emit("skill.install.failed", { userId, skillKey, reason: failed.reason });
        return failed;
      }

      emit("skill.install.started", { userId, skillKey });
      if (skill.missingRequirements.length > 0) {
        const failed: SkillInstallRecord = {
          installId: randomUUID(),
          userId,
          skillKey,
          status: "failed",
          reason: "missing_requirements",
          createdAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        };
        emit("skill.install.failed", {
          userId,
          skillKey,
          reason: failed.reason,
          missingRequirements: [...skill.missingRequirements],
        });
        return failed;
      }

      const completed: SkillInstallRecord = {
        installId: randomUUID(),
        userId,
        skillKey,
        status: "completed",
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      };
      emit("skill.install.completed", { userId, skillKey });
      return completed;
    },

    configureSkill: (userId, skillKey, enabled, env) => {
      const key = `${userId}:${skillKey}`;
      const config: SkillConfigRecord = {
        userId,
        skillKey,
        enabled,
        env: { ...env },
        updatedAt: new Date().toISOString(),
      };
      skillConfigs.set(key, config);
      return { ...config, env: { ...config.env } };
    },

    completeSetup: (userId, tenantId, workspaceId) => {
      const key = `${userId}:${tenantId}:${workspaceId}`;
      const completion: SetupCompletionRecord = {
        userId,
        tenantId,
        workspaceId,
        completedAt: new Date().toISOString(),
      };
      setupCompletions.set(key, completion);
      emit("setup.completed", { userId, tenantId, workspaceId });
      return { ...completion };
    },

    listEvents: () => events.map((event) => ({ ...event, payload: { ...event.payload } })),
  };
};
