import type { ConversationServiceConfig } from "./types.js";

const parseCsv = (raw: string | undefined, fallback: string[]): string[] => {
  if (!raw) {
    return fallback;
  }
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
};

const parseTenantProviders = (raw: string | undefined): Record<string, string[]> => {
  if (!raw) {
    return {};
  }
  const result: Record<string, string[]> = {};
  for (const segment of raw.split(";")) {
    const trimmed = segment.trim();
    if (!trimmed) {
      continue;
    }
    const firstColon = trimmed.indexOf(":");
    if (firstColon <= 0 || firstColon === trimmed.length - 1) {
      continue;
    }
    const tenantId = trimmed.slice(0, firstColon);
    const providers = trimmed.slice(firstColon + 1);
    result[tenantId.trim()] = providers
      .split("|")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }
  return result;
};

const parseTenantProviderKeyRefs = (
  raw: string | undefined,
): Record<string, Record<string, string>> => {
  if (!raw) {
    return {};
  }
  const result: Record<string, Record<string, string>> = {};
  for (const segment of raw.split(";")) {
    const trimmed = segment.trim();
    if (!trimmed) {
      continue;
    }
    const firstColon = trimmed.indexOf(":");
    if (firstColon <= 0 || firstColon === trimmed.length - 1) {
      continue;
    }
    const tenantId = trimmed.slice(0, firstColon);
    const mappings = trimmed.slice(firstColon + 1);
    const keyRefs: Record<string, string> = {};
    for (const mapping of mappings.split(",")) {
      const [provider, keyRef] = mapping.split("=").map((value) => value?.trim());
      if (!provider || !keyRef) {
        continue;
      }
      keyRefs[provider] = keyRef;
    }
    result[tenantId.trim()] = keyRefs;
  }
  return result;
};

export const loadConfig = (): ConversationServiceConfig => {
  const port = Number.parseInt(process.env.PORT ?? "4008", 10);
  const defaultRetentionDays = Number.parseInt(
    process.env.CONVERSATION_DEFAULT_RETENTION_DAYS ?? "30",
    10,
  );
  const maxRetentionDays = Number.parseInt(
    process.env.CONVERSATION_MAX_RETENTION_DAYS ?? "365",
    10,
  );

  return {
    port: Number.isInteger(port) && port > 0 ? port : 4008,
    defaultRetentionDays:
      Number.isInteger(defaultRetentionDays) && defaultRetentionDays > 0
        ? defaultRetentionDays
        : 30,
    maxRetentionDays:
      Number.isInteger(maxRetentionDays) && maxRetentionDays > 0 ? maxRetentionDays : 365,
    globallyAllowedProviders: parseCsv(process.env.PROVIDER_ALLOWED_LIST, ["openai", "anthropic"]),
    tenantProviderPolicies: parseTenantProviders(process.env.TENANT_PROVIDER_POLICY),
    tenantProviderKeyRefs: parseTenantProviderKeyRefs(process.env.TENANT_PROVIDER_KEY_REFS),
  };
};
