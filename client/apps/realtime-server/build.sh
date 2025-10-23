#!/bin/bash

# This script bundles the realtime server with its workspace dependencies for deployment

# Build workspace dependencies first
cd ../../../
pnpm install --frozen-lockfile
pnpm run build:packages

# Bundle everything into a standalone directory
cd client/apps/realtime-server
mkdir -p dist-standalone/node_modules/@bibliothecadao

# Copy workspace dependencies
cp -r ../../../packages/types/dist dist-standalone/node_modules/@bibliothecadao/types
cp ../../../packages/types/package.json dist-standalone/node_modules/@bibliothecadao/types/

# Copy the app files
cp -r src dist-standalone/
cp package.json dist-standalone/
cp tsconfig.json dist-standalone/

# Install production dependencies in the standalone directory
cd dist-standalone
bun install --production

echo "Standalone build ready in dist-standalone/"