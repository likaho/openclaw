import { describe, expect, it } from "vitest";
import type { SkillRuntimeConfig } from "./config.js";
import { validateCapability, validateMemory, validateRuntime, validateTimeout } from "./guards.js";

const config: SkillRuntimeConfig = {
  port: 0,
  maxTimeoutMs: 30_000,
  maxMemoryMb: 512,
  allowedCapabilities: ["no-network", "http-readonly"],
};

describe("runtime guards", () => {
  it("validates supported runtimes", () => {
    expect(validateRuntime("node")).toBe(true);
    expect(validateRuntime("python")).toBe(true);
    expect(validateRuntime("ruby")).toBe(false);
  });

  it("enforces capability allowlist", () => {
    expect(validateCapability("http-readonly", config)).toBe(true);
    expect(validateCapability("tenant-storage", config)).toBe(false);
  });

  it("enforces timeout and memory limits", () => {
    expect(validateTimeout(10_000, config)).toBe(true);
    expect(validateTimeout(40_000, config)).toBe(false);
    expect(validateMemory(256, config)).toBe(true);
    expect(validateMemory(1024, config)).toBe(false);
  });
});
