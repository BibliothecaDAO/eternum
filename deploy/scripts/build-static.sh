#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<USAGE
Usage: $0

Builds the Vite clients and stages the static artifacts under deploy/artifacts.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

ROOT_DIR=$(git rev-parse --show-toplevel)
ARTIFACT_ROOT="$ROOT_DIR/deploy/artifacts"
GAME_DIR="$ROOT_DIR/apps/game"

mkdir -p "$ARTIFACT_ROOT"

echo "Building web client"
pnpm --dir "$GAME_DIR" build
rm -rf "$ARTIFACT_ROOT/game-dist"
cp -R "$GAME_DIR/dist" "$ARTIFACT_ROOT/game-dist"

echo "Static assets staged under $ARTIFACT_ROOT"
