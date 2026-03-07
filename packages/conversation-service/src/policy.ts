import type { ConversationServiceConfig } from "./types.js";

export const isProviderAllowedForTenant = (
  config: ConversationServiceConfig,
  tenantId: string,
  provider: string,
): boolean => {
  if (!config.globallyAllowedProviders.includes(provider)) {
    return false;
  }
  const tenantPolicy = config.tenantProviderPolicies[tenantId];
  if (!tenantPolicy) {
    return false;
  }
  return tenantPolicy.includes(provider);
};

export const resolveProviderKeyRef = (
  config: ConversationServiceConfig,
  tenantId: string,
  provider: string,
): string | undefined => config.tenantProviderKeyRefs[tenantId]?.[provider];
