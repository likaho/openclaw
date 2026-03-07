FROM node:22-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY packages/onboarding-service/package.json ./packages/onboarding-service/package.json

RUN corepack enable && pnpm install --frozen-lockfile

COPY packages/onboarding-service ./packages/onboarding-service

WORKDIR /app/packages/onboarding-service

EXPOSE 4010

CMD ["pnpm", "start"]
