#!/usr/bin/env bash
set -euo pipefail

runtime_pid_file="${RUNTIME_PID_FILE:-/runtime-control/runtime.pid}"

serve() {
  trap 'exit 0' TERM INT
  while true; do
    sleep 3600 &
    wait "$!"
  done
}

kill_runtime() {
  local runtime_pid
  runtime_pid="$(cat "${runtime_pid_file}")"
  if [[ ! "${runtime_pid}" =~ ^[1-9][0-9]*$ ]]; then
    echo "invalid runtime PID in ${runtime_pid_file}" >&2
    exit 1
  fi

  kill -KILL "${runtime_pid}"
  echo "runtime-killed:${runtime_pid}"
}

case "${1:-serve}" in
  serve)
    serve
    ;;
  kill-runtime)
    kill_runtime
    ;;
  *)
    echo "unsupported checkpoint agent operation: ${1}" >&2
    exit 1
    ;;
esac
