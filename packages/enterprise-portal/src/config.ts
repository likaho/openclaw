export type PortalConfig = {
  port: number;
  onboardingBaseUrl: string;
  identityBaseUrl: string;
};

const parsePort = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const loadConfig = (): PortalConfig => ({
  port: parsePort(process.env.PORT, 4020),
  onboardingBaseUrl: process.env.ONBOARDING_BASE_URL ?? "http://onboarding-service:4010",
  identityBaseUrl: process.env.IDENTITY_BASE_URL ?? "http://identity-service:4001",
});
