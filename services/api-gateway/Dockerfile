FROM node:22-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy service source
COPY services/api-gateway/package*.json ./services/api-gateway/
COPY services/shared/ ./services/shared/

WORKDIR /app/services/api-gateway
RUN pnpm install --frozen-lockfile

COPY services/api-gateway/ ./
RUN pnpm build

# Production image
FROM node:22-alpine

WORKDIR /app

# Install dependencies for runtime
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S openclaw && \
    adduser -u 1001 -S openclaw -G openclaw

# Copy built artifacts
COPY --from=builder /app/services/api-gateway/dist ./dist
COPY --from=builder /app/services/api-gateway/package.json ./

# Install production dependencies
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN pnpm install --prod --frozen-lockfile

# Switch to non-root user
USER openclaw

# Expose port
EXPOSE 18789

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:18789/health || exit 1

# Run service
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
