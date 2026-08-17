#!/usr/bin/env bash
# Builds the appchain Torii binary and stages it into the Docker build context.
# The checkout lives outside this repo (djizus/torii, branch
# feat/dynamic-contract-indexing) and contains both the multi-world GraphQL
# fix and append-only dynamic contract registration.
#
# Usage: TORII_SRC=/path/to/patched/torii scripts/build-torii.sh
set -euo pipefail

SPIKE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TORII_SRC="${TORII_SRC:?set TORII_SRC to the patched torii checkout}"

(cd "$TORII_SRC" && cargo build --release --bin torii)
cp "$TORII_SRC/target/release/torii" "$SPIKE_DIR/docker/torii/torii"
echo "==> staged $(du -h "$SPIKE_DIR/docker/torii/torii" | cut -f1) binary; rebuild with:"
echo "    docker-compose build torii && docker-compose --profile torii up -d --force-recreate torii"
