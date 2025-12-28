# Multi-stage build for wilfredwake
FROM node:18-alpine AS base

WORKDIR /app

# Install dependencies stage
FROM base AS dependencies
COPY package*.json ./
RUN npm ci --only=production

# Development dependencies stage
FROM base AS dev-dependencies
COPY package*.json ./
RUN npm ci

# Production image
FROM base AS production

LABEL maintainer="Wilfred Wake"
LABEL description="CLI Tool for Multi-Developer Development Environment Wake & Status Management"

# Set environment to production
ENV NODE_ENV=production
ENV PATH="/app/node_modules/.bin:$PATH"

# Copy production dependencies
COPY --from=dependencies /app/node_modules ./node_modules

# Copy application code
COPY . .

# Make CLI executable
RUN chmod +x bin/cli.js

# Health check for orchestrator mode
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})" || exit 1

# Default to CLI - can be overridden to run orchestrator server
ENTRYPOINT ["node"]
CMD ["bin/cli.js", "--help"]

# Development image
FROM base AS development

ENV NODE_ENV=development
ENV PATH="/app/node_modules/.bin:$PATH"

# Copy all dependencies (including devDependencies)
COPY --from=dev-dependencies /app/node_modules ./node_modules

# Copy application code
COPY . .

# Make CLI executable
RUN chmod +x bin/cli.js

ENTRYPOINT ["node"]
CMD ["--experimental-watch", "bin/cli.js", "--help"]
