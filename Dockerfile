# Builder stage: Install deps, build app
FROM node:20-alpine AS builder

# Enable pnpm via corepack (no global install needed)
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy lockfile + package.json first for Docker layer caching
COPY pnpm-lock.yaml package.json ./

# Install all deps (including dev for build step)
RUN pnpm install --frozen-lockfile

# Copy source code and run build (TSC + Nest build)
COPY . .
RUN pnpm build

# Enable CI mode for prune (fixes TTY abort in Docker)
ENV CI=true

# Prune to production deps only (removes dev tools like TypeScript)
RUN pnpm prune --prod

# Production stage: Slim image with built artifacts
FROM node:20-alpine

# Re-enable pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Add curl for healthcheck (from your compose)
RUN apk add --no-cache curl

WORKDIR /app

# Copy built dist, pruned node_modules, and package.json from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Expose port (matches your compose)
EXPOSE 3000

# Healthcheck command (optional: runs inside container, but compose overrides it)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl --fail http://localhost:3000/health || exit 1

# Run production (node dist/main via your script)
CMD ["pnpm", "start:prod"]