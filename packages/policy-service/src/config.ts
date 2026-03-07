export type PolicyServiceConfig = {
  port: number;
};

export const loadConfig = (): PolicyServiceConfig => ({
  port: Number(process.env.PORT ?? 4003),
});
