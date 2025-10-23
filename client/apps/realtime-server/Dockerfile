# Build stage
FROM oven/bun:latest as builder

WORKDIR /app

# Copy root package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY .npmrc ./

# Copy workspace packages
COPY packages/types ./packages/types

# Copy the realtime server app
COPY client/apps/realtime-server ./client/apps/realtime-server

# Install dependencies
RUN bun install -g pnpm
RUN pnpm install --frozen-lockfile

# Build packages
WORKDIR /app/packages/types
RUN pnpm run build

# Build realtime server
WORKDIR /app/client/apps/realtime-server
RUN pnpm run build

# Production stage
FROM oven/bun:latest

WORKDIR /app

# Copy built files and dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/client/apps/realtime-server ./client/apps/realtime-server

WORKDIR /app/client/apps/realtime-server

# Expose the port your server runs on
EXPOSE 8080

# Start the server
CMD ["bun", "run", "start"]