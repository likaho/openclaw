import type { OnboardingServiceConfig } from "./types.js";

export const loadConfig = (): OnboardingServiceConfig => {
  const port = Number.parseInt(process.env.PORT ?? "4010", 10);
  return {
    port: Number.isInteger(port) && port > 0 ? port : 4010,
    defaultWorkspace: process.env.ONBOARDING_DEFAULT_WORKSPACE ?? "default",
  };
};
