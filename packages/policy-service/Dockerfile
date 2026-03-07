FROM node:22-slim AS deps

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/policy-service/package.json packages/policy-service/package.json

RUN corepack enable \
    && pnpm install --filter @openclaw/policy-service... --prod

FROM node:22-slim

WORKDIR /app

COPY --from=deps /app/node_modules /app/node_modules
COPY packages/policy-service /app/packages/policy-service

WORKDIR /app/packages/policy-service

ENV NODE_ENV=production

CMD ["node", "--import", "tsx", "src/index.ts"]
