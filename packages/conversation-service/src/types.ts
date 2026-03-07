export type ConversationRole = "system" | "user" | "assistant";

export type MemoryEntry = {
  id: string;
  tenantId: string;
  conversationId: string;
  role: ConversationRole;
  content: string;
  createdAt: string;
  expiresAt: string;
};

export type ProviderProxyRequest = {
  tenantId: string;
  provider: string;
  model: string;
  prompt: string;
  correlationId?: string;
};

export type ProviderProxyResponse = {
  requestId: string;
  tenantId: string;
  provider: string;
  model: string;
  completion: string;
  keyRef: string;
  createdAt: string;
};

export type AuditEvent = {
  sequence: number;
  tenantId: string;
  eventType: string;
  actor: string;
  payload: Record<string, unknown>;
  createdAt: string;
  previousHash: string | null;
  hash: string;
};

export type ConversationServiceConfig = {
  port: number;
  defaultRetentionDays: number;
  maxRetentionDays: number;
  globallyAllowedProviders: string[];
  tenantProviderPolicies: Record<string, string[]>;
  tenantProviderKeyRefs: Record<string, Record<string, string>>;
};
