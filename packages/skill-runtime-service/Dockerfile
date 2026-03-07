FROM node:22-slim AS deps

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/skill-runtime-service/package.json packages/skill-runtime-service/package.json

RUN corepack enable \
    && pnpm install --filter @openclaw/skill-runtime-service... --prod

FROM node:22-slim

WORKDIR /app

COPY --from=deps /app/node_modules /app/node_modules
COPY packages/skill-runtime-service /app/packages/skill-runtime-service

WORKDIR /app/packages/skill-runtime-service

ENV NODE_ENV=production

CMD ["node", "--import", "tsx", "src/index.ts"]
