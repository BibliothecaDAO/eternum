#!/usr/bin/env bash
# Upgrade this box's cloudflared to the newest package without dropping the tunnel: a temporary second connector with
# the same token carries traffic while the main one restarts, then stops. Safe to run twice, or again after a crash:
# it skips what is already done and always ends with the main connector on the installed version and no replica.
#
#   ssh <box> 'sudo bash -s' < deploy/athanor/host/upgrade-tunnel.sh
#
# Run it between Blitz games: long-lived connections (Herald sockets) on each restarted connector drop and reconnect.
set -euo pipefail

MAIN_METRICS=127.0.0.1:20241
REPLICA_METRICS=127.0.0.1:20242
REPLICA=cloudflared-replica
READY_SECONDS=90

installed_version() { dpkg-query -W -f='${Version}' cloudflared; }

running_version() {
  curl -fsS "http://$1/metrics" 2>/dev/null | sed -nE 's/^build_info\{.*version="([^"]+)".*/\1/p'
}

ready_connections() {
  curl -fsS "http://$1/ready" 2>/dev/null | sed -nE 's/.*"readyConnections":([0-9]+).*/\1/p'
}

# Ready means every edge connection is registered and the connector runs the installed version.
wait_until_ready() {
  local metrics=$1 deadline=$((SECONDS + READY_SECONDS))
  until [ "$(ready_connections "$metrics")" = 4 ] && [ "$(running_version "$metrics")" = "$(installed_version)" ]; do
    [ "$SECONDS" -lt "$deadline" ] || { echo "cloudflared on $metrics not ready on $(installed_version)" >&2; return 1; }
    sleep 1
  done
  echo "cloudflared on $metrics ready: 4 connections, $(running_version "$metrics")"
}

start_replica() {
  systemctl is-active --quiet "$REPLICA" ||
    systemd-run --unit "$REPLICA" -p MemoryMax=256M /usr/bin/cloudflared tunnel --no-autoupdate \
      --metrics "$REPLICA_METRICS" run --token-file /etc/cloudflared/tunnel-token
  wait_until_ready "$REPLICA_METRICS"
}

# If the main connector fails to come back, the replica keeps serving and this exits non-zero for the operator.
restart_main() {
  systemctl restart cloudflared.service
  wait_until_ready "$MAIN_METRICS"
}

stop_replica() {
  if systemctl is-active --quiet "$REPLICA"; then systemctl stop "$REPLICA"; fi
  echo "replica stopped"
}

main() {
  [ "$(id -u)" -eq 0 ] || { echo "Run as root" >&2; return 1; }
  echo "before: running $(running_version "$MAIN_METRICS"), installed $(installed_version)"
  apt-get update -q
  apt-get install -y -q cloudflared
  if [ "$(running_version "$MAIN_METRICS")" != "$(installed_version)" ]; then
    start_replica
    restart_main
  fi
  stop_replica
  echo "after: running $(running_version "$MAIN_METRICS"), installed $(installed_version)"
}

if [[ "${BASH_SOURCE[0]:-$0}" == "$0" ]]; then
  main
fi
