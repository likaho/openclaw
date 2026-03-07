FROM node:22-slim

WORKDIR /app

COPY packages/enterprise-portal/package.json ./package.json
RUN npm install --omit=dev

COPY packages/enterprise-portal/src ./src

ENV PORT=4020

EXPOSE 4020

CMD ["node", "--import", "tsx", "src/index.ts"]
