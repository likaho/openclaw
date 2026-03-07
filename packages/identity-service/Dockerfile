FROM node:22-slim AS deps

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/identity-service/package.json packages/identity-service/package.json

RUN corepack enable \
    && pnpm install --filter @openclaw/identity-service... --prod

FROM node:22-slim

WORKDIR /app

COPY --from=deps /app/node_modules /app/node_modules
COPY packages/identity-service /app/packages/identity-service

WORKDIR /app/packages/identity-service

ENV NODE_ENV=production

CMD ["node", "--import", "tsx", "src/index.ts"]
