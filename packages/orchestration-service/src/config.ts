export type OrchestrationConfig = {
  port: number;
};

export const loadConfig = (): OrchestrationConfig => ({
  port: Number(process.env.PORT ?? 4005),
});
