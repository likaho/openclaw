FROM node:22-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY packages/conversation-service/package.json ./packages/conversation-service/package.json

RUN corepack enable && pnpm install --frozen-lockfile

COPY packages/conversation-service ./packages/conversation-service

WORKDIR /app/packages/conversation-service

EXPOSE 4008

CMD ["pnpm", "start"]
