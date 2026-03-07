export type ChannelIngressConfig = {
  port: number;
  ingressApiKey?: string;
};

export const loadConfig = (): ChannelIngressConfig => ({
  port: Number(process.env.PORT ?? 4004),
  ingressApiKey: process.env.INGRESS_API_KEY,
});
