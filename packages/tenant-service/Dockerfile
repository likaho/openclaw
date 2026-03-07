FROM node:22-slim AS deps

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/tenant-service/package.json packages/tenant-service/package.json

RUN corepack enable \
    && pnpm install --filter @openclaw/tenant-service... --prod

FROM node:22-slim

WORKDIR /app

COPY --from=deps /app/node_modules /app/node_modules
COPY packages/tenant-service /app/packages/tenant-service

WORKDIR /app/packages/tenant-service

ENV NODE_ENV=production

CMD ["node", "--import", "tsx", "src/index.ts"]
