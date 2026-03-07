import type { SkillRuntimeConfig } from "./config.js";
import type { RuntimeKind } from "./types.js";

export const validateRuntime = (runtime: string): runtime is RuntimeKind =>
  runtime === "node" || runtime === "python";

export const validateCapability = (
  capabilityProfile: string,
  config: SkillRuntimeConfig,
): boolean => config.allowedCapabilities.includes(capabilityProfile);

export const validateTimeout = (timeoutMs: number, config: SkillRuntimeConfig): boolean =>
  Number.isInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= config.maxTimeoutMs;

export const validateMemory = (memoryMb: number, config: SkillRuntimeConfig): boolean =>
  Number.isInteger(memoryMb) && memoryMb > 0 && memoryMb <= config.maxMemoryMb;
