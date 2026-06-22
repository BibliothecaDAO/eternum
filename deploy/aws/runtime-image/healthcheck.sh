#!/usr/bin/env bash
set -euo pipefail

public_port="${PUBLIC_PORT:-8080}"
curl --fail --silent --show-error "http://127.0.0.1:${public_port}/health" >/dev/null
