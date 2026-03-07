export type TenantServiceConfig = {
  port: number;
};

export const loadConfig = (): TenantServiceConfig => ({
  port: Number(process.env.PORT ?? 4002),
});
