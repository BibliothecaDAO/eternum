#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<USAGE
Usage: $0 [--include-mobile]

Builds the Vite clients and stages the static artifacts under deploy/artifacts.
USAGE
}

INCLUDE_MOBILE=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --include-mobile)
      INCLUDE_MOBILE=true
      shift
      ;;
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
GAME_DIR="$ROOT_DIR/client/apps/game"
MOBILE_DIR="$ROOT_DIR/client/apps/eternum-mobile"

mkdir -p "$ARTIFACT_ROOT"

echo "Building web client"
pnpm --dir "$GAME_DIR" build
rm -rf "$ARTIFACT_ROOT/game-dist"
cp -R "$GAME_DIR/dist" "$ARTIFACT_ROOT/game-dist"

if [[ "$INCLUDE_MOBILE" == true ]]; then
  echo "Building mobile client"
  pnpm --dir "$MOBILE_DIR" build
  rm -rf "$ARTIFACT_ROOT/mobile-dist"
  cp -R "$MOBILE_DIR/dist" "$ARTIFACT_ROOT/mobile-dist"
fi

echo "Static assets staged under $ARTIFACT_ROOT"
