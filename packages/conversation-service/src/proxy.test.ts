import { describe, expect, test } from "vitest";
import { proxyProviderRequest } from "./proxy.js";
import { createInMemoryConversationStore } from "./store.js";
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
    "tenant-b": {},
  },
};

describe("provider proxy", () => {
  test("rejects disallowed provider and records deny audit", () => {
    const store = createInMemoryConversationStore();
    const result = proxyProviderRequest(config, store, {
      tenantId: "tenant-a",
      provider: "anthropic",
      model: "claude",
      prompt: "hello",
    });
    expect(result).toEqual({ ok: false, status: 403, error: "provider_not_allowed" });

    const events = store.listAuditEvents("tenant-a");
    expect(events).toHaveLength(1);
    expect(events[0]?.eventType).toBe("provider.proxy.denied");
  });

  test("rejects when provider key reference is missing", () => {
    const store = createInMemoryConversationStore();
    const result = proxyProviderRequest(config, store, {
      tenantId: "tenant-b",
      provider: "anthropic",
      model: "claude",
      prompt: "hello",
    });
    expect(result).toEqual({ ok: false, status: 403, error: "provider_key_ref_not_configured" });
  });

  test("returns simulated completion when allowed", () => {
    const store = createInMemoryConversationStore();
    const result = proxyProviderRequest(config, store, {
      tenantId: "tenant-a",
      provider: "openai",
      model: "gpt-4o-mini",
      prompt: "hello world",
      correlationId: "corr-1",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.response.keyRef).toBe("vault://tenant-a/openai");
    expect(result.response.completion).toContain("simulated:openai/gpt-4o-mini");

    const events = store.listAuditEvents("tenant-a");
    expect(events).toHaveLength(1);
    expect(events[0]?.eventType).toBe("provider.proxy.invoked");
  });
});
