#!/usr/bin/env bash
set -euo pipefail

runtime_kind="${RUNTIME_KIND:-}"
data_dir="${DATA_DIR:-/data}"
internal_port="${INTERNAL_PORT:-8081}"
dry_run="${RUNTIME_ENTRYPOINT_DRY_RUN:-0}"
cleanup_path="${RUNTIME_CLEANUP_PATH:-}"
runtime_pid_file="${RUNTIME_PID_FILE:-/runtime-control/runtime.pid}"

print_command() {
  printf '%s\n' "$@"
}

append_katana_extra_args() {
  if [[ -z "${KATANA_EXTRA_ARGS:-}" ]]; then
    return
  fi

  local extra_args=()
  read -r -a extra_args <<< "${KATANA_EXTRA_ARGS}"
  katana_args+=("${extra_args[@]}")
}

build_katana_args() {
  katana_args=(
    katana
    --host 127.0.0.1
    --port "${internal_port}"
    --db-dir "${data_dir}/katana"
  )

  if [[ -n "${KATANA_CHAIN_ID:-}" ]]; then
    katana_args+=(--chain-id "${KATANA_CHAIN_ID}")
  fi

  if [[ -n "${KATANA_BLOCK_TIME:-}" ]]; then
    katana_args+=(--block-time "${KATANA_BLOCK_TIME}")
  fi

  append_katana_extra_args
}

start_katana() {
  mkdir -p "${data_dir}/katana"
  local katana_args=()
  build_katana_args

  if [[ "${dry_run}" == "1" ]]; then
    print_command "${katana_args[@]}"
    return
  fi

  exec "${katana_args[@]}"
}

start_torii() {
  mkdir -p "${data_dir}/torii"
  node /usr/local/bin/render-torii-config.mjs > /tmp/torii.toml
  exec torii --config /tmp/torii.toml
}

cleanup_runtime_path() {
  mkdir -p "${cleanup_path}"
  find "${cleanup_path}" -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +
  echo "runtime-cleanup-path-cleaned: ${cleanup_path}"
}

if [[ -n "${cleanup_path}" ]]; then
  cleanup_runtime_path
  exit 0
fi

if [[ "${dry_run}" == "1" ]]; then
  case "${runtime_kind}" in
    katana)
      start_katana
      ;;
    torii)
      echo "torii dry run is not supported" >&2
      exit 1
      ;;
    *)
      echo "Unsupported RUNTIME_KIND: ${runtime_kind}" >&2
      exit 1
      ;;
  esac
  exit 0
fi

mkdir -p "${data_dir}"
printf '%s\n' "$$" > "${runtime_pid_file}"
node /usr/local/bin/runtime-snapshot.mjs restore

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
export RUNTIME_PID="${runtime_pid}"
node /usr/local/bin/path-proxy.mjs &
proxy_pid="$!"
node /usr/local/bin/runtime-snapshot.mjs snapshot-loop &
snapshot_pid="$!"

shutdown() {
  rm -f "${runtime_pid_file}"
  kill "${snapshot_pid}" 2>/dev/null || true
  wait "${snapshot_pid}" 2>/dev/null || true
  kill "${runtime_pid}" 2>/dev/null || true
  wait "${runtime_pid}" 2>/dev/null || true
  node /usr/local/bin/runtime-snapshot.mjs snapshot-once || true
  kill "${proxy_pid}" 2>/dev/null || true
  wait "${proxy_pid}" 2>/dev/null || true
}

trap shutdown EXIT TERM INT

wait -n "${runtime_pid}" "${proxy_pid}" "${snapshot_pid}"
