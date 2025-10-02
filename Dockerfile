# Multi-stage Dockerfile for Miko
# 1. Dependencies install (cached)
# 2. Builder for Next.js
# 3. Runner (production)

# Base image choice: Using Node 20 LTS (compatible with Next 15)
FROM node:20 AS deps
WORKDIR /app
# Alpine specific libc addition not required on Debian base
COPY package.json package-lock.json* .npmrc* ./
# Install all dependencies including optional (needed for lightningcss native binary)
RUN npm ci --no-audit

FROM node:20 AS builder
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Build the Next.js app (using default output)
RUN npm run build

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
# Prevent Next telemetry
ENV NEXT_TELEMETRY_DISABLED=1

# Copy only necessary artifacts
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.* ./
COPY --from=builder /app/src ./src

EXPOSE 3000

# Default command; can be overridden in docker-compose.yml for dev
CMD ["npm", "run", "start"]
