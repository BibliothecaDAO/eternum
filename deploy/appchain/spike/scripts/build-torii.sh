#!/usr/bin/env bash
# Builds the multi-world-patched torii binary and stages it into the docker
# build context. The patched checkout lives outside the repo (torii fork,
# v1.8.16 + graphql dedupe patch — see docker/torii/Dockerfile for the story).
#
# Usage: TORII_SRC=/path/to/patched/torii scripts/build-torii.sh
set -euo pipefail

SPIKE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TORII_SRC="${TORII_SRC:?set TORII_SRC to the patched torii checkout}"

(cd "$TORII_SRC" && cargo build --release --bin torii)
cp "$TORII_SRC/target/release/torii" "$SPIKE_DIR/docker/torii/torii"
echo "==> staged $(du -h "$SPIKE_DIR/docker/torii/torii" | cut -f1) binary; rebuild with:"
echo "    docker-compose build torii && docker-compose --profile torii up -d --force-recreate torii"
