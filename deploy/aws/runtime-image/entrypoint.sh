#!/usr/bin/env bash
set -euo pipefail

runtime_kind="${RUNTIME_KIND:-}"
data_dir="${DATA_DIR:-/data}"
internal_port="${INTERNAL_PORT:-8081}"

mkdir -p "${data_dir}"

start_katana() {
  mkdir -p "${data_dir}/katana"
  exec katana \
    --host 127.0.0.1 \
    --port "${internal_port}" \
    --db-dir "${data_dir}/katana"
}

start_torii() {
  mkdir -p "${data_dir}/torii"
  node /usr/local/bin/render-torii-config.mjs > /tmp/torii.toml
  exec torii --config /tmp/torii.toml
}

case "${runtime_kind}" in
  katana)
    start_katana &
    ;;
  torii)
    start_torii &
    ;;
  *)
    echo "Unsupported RUNTIME_KIND: ${runtime_kind}" >&2
    exit 1
    ;;
esac

runtime_pid="$!"
node /usr/local/bin/path-proxy.mjs &
proxy_pid="$!"

trap 'kill "${runtime_pid}" "${proxy_pid}" 2>/dev/null || true' EXIT

wait -n "${runtime_pid}" "${proxy_pid}"
