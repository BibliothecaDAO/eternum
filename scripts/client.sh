#!/bin/bash

# Navigate to the root of the repo to install dependencies
echo "Installing dependencies..."

pnpm i && pnpm build-packages

# Copy .env.sample to .env.local
cp client/.env.sample client/.env.local

pnpm dev