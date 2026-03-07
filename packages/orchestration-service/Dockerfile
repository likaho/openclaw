FROM node:22-slim AS deps

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/orchestration-service/package.json packages/orchestration-service/package.json

RUN corepack enable \
    && pnpm install --filter @openclaw/orchestration-service... --prod

FROM node:22-slim

WORKDIR /app

COPY --from=deps /app/node_modules /app/node_modules
COPY packages/orchestration-service /app/packages/orchestration-service

WORKDIR /app/packages/orchestration-service

ENV NODE_ENV=production

CMD ["node", "--import", "tsx", "src/index.ts"]
