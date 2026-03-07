import { describe, expect, test } from "vitest";
import { isProviderAllowedForTenant, resolveProviderKeyRef } from "./policy.js";
import type { ConversationServiceConfig } from "./types.js";

const config: ConversationServiceConfig = {
  port: 4008,
  defaultRetentionDays: 30,
  maxRetentionDays: 365,
  globallyAllowedProviders: ["openai", "anthropic"],
  tenantProviderPolicies: {
    "tenant-a": ["openai"],
    "tenant-b": ["anthropic"],
  },
  tenantProviderKeyRefs: {
    "tenant-a": { openai: "vault://tenant-a/openai" },
  },
};

describe("provider policy", () => {
  test("allows only tenant-configured providers", () => {
    expect(isProviderAllowedForTenant(config, "tenant-a", "openai")).toBe(true);
    expect(isProviderAllowedForTenant(config, "tenant-a", "anthropic")).toBe(false);
    expect(isProviderAllowedForTenant(config, "tenant-z", "openai")).toBe(false);
  });

  test("resolves key refs per tenant/provider", () => {
    expect(resolveProviderKeyRef(config, "tenant-a", "openai")).toBe("vault://tenant-a/openai");
    expect(resolveProviderKeyRef(config, "tenant-b", "openai")).toBeUndefined();
  });
});
