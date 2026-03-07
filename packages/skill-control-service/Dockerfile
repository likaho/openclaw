FROM node:22-slim AS deps

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/skill-control-service/package.json packages/skill-control-service/package.json

RUN corepack enable \
    && pnpm install --filter @openclaw/skill-control-service... --prod

FROM node:22-slim

WORKDIR /app

COPY --from=deps /app/node_modules /app/node_modules
COPY packages/skill-control-service /app/packages/skill-control-service

WORKDIR /app/packages/skill-control-service

ENV NODE_ENV=production

CMD ["node", "--import", "tsx", "src/index.ts"]
