export type SkillControlConfig = {
  port: number;
  signatureKey: string;
};

export const loadConfig = (): SkillControlConfig => ({
  port: Number(process.env.PORT ?? 4006),
  signatureKey: process.env.SKILL_SIGNATURE_KEY ?? "local-skill-signature-key",
});
