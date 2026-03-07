export type SkillRuntimeConfig = {
  port: number;
  maxTimeoutMs: number;
  maxMemoryMb: number;
  allowedCapabilities: string[];
};

const parseList = (value: string | undefined, fallback: string[]): string[] => {
  if (!value) {
    return fallback;
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

export const loadConfig = (): SkillRuntimeConfig => ({
  port: Number(process.env.PORT ?? 4007),
  maxTimeoutMs: Number(process.env.RUNTIME_MAX_TIMEOUT_MS ?? 30000),
  maxMemoryMb: Number(process.env.RUNTIME_MAX_MEMORY_MB ?? 512),
  allowedCapabilities: parseList(process.env.RUNTIME_ALLOWED_CAPABILITIES, [
    "no-network",
    "http-readonly",
    "tenant-api-only",
  ]),
});
