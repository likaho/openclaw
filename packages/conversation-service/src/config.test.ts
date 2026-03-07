import { afterEach, describe, expect, test } from "vitest";
import { loadConfig } from "./config.js";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("loadConfig", () => {
  test("parses tenant key refs with URL-like values", () => {
    process.env.TENANT_PROVIDER_KEY_REFS =
      "tenant-a:openai=vault://tenant-a/openai,anthropic=vault://tenant-a/anthropic";
    process.env.TENANT_PROVIDER_POLICY = "tenant-a:openai|anthropic";

    const config = loadConfig();
    expect(config.tenantProviderKeyRefs["tenant-a"]?.openai).toBe("vault://tenant-a/openai");
    expect(config.tenantProviderKeyRefs["tenant-a"]?.anthropic).toBe("vault://tenant-a/anthropic");
  });
});
