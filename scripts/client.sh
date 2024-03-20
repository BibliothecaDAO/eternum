#!/bin/bash

# Navigate to the root of the repo to install dependencies
echo "Installing dependencies..."

pnpm i && pnpm build-packages

pnpm dev