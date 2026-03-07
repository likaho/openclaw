FROM node:22-slim AS deps

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/channel-ingress-service/package.json packages/channel-ingress-service/package.json

RUN corepack enable \
    && pnpm install --filter @openclaw/channel-ingress-service... --prod

FROM node:22-slim

WORKDIR /app

COPY --from=deps /app/node_modules /app/node_modules
COPY packages/channel-ingress-service /app/packages/channel-ingress-service

WORKDIR /app/packages/channel-ingress-service

ENV NODE_ENV=production

CMD ["node", "--import", "tsx", "src/index.ts"]
