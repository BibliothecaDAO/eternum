#!/usr/bin/env bash
# Upgrade this box's cloudflared to the newest package without dropping the tunnel: a temporary second connector with
# the same token carries traffic while the main one restarts, then stops. Safe to run twice, or again after a crash:
# it always ends with the main connector ready on the installed version and no replica, or exits non-zero with the
# replica still serving.
#
#   ssh <box> 'sudo bash -s' < deploy/athanor/host/upgrade-tunnel.sh
#
# Run it between Blitz games: long-lived connections (Herald sockets) on each restarted connector drop and reconnect.
# bootstrap.sh sources this file for the version floor, so both entrypoints refuse the same unsafe versions.
set -euo pipefail

# Cloudflare, October 2026: older cloudflared trusts eight compromised emSign intermediate certificates.
CLOUDFLARED_MIN=2026.10.2
MAIN_METRICS=127.0.0.1:20241
REPLICA_METRICS=127.0.0.1:20242
REPLICA=cloudflared-replica
READY_SECONDS=90

installed_version() { dpkg-query -W -f='${Version}' cloudflared 2>/dev/null; }

# A stale mirror or a held package must stop the operator, not leave a tunnel on an unsafe version.
require_safe_cloudflared() {
  local installed lowest
  installed=$(installed_version || true)
  lowest=$(printf '%s\n' "$CLOUDFLARED_MIN" "$installed" | sort -V | head -n 1)
  [ -n "$installed" ] && [ "$lowest" = "$CLOUDFLARED_MIN" ] ||
    { echo "cloudflared ${installed:-(none)} is older than $CLOUDFLARED_MIN; run apt-get update and install it again" >&2; return 1; }
}

running_version() {
  curl -fsS "http://$1/metrics" 2>/dev/null | sed -nE 's/^build_info\{.*version="([^"]+)".*/\1/p'
}

ready_connections() {
  curl -fsS "http://$1/ready" 2>/dev/null | sed -nE 's/.*"readyConnections":([0-9]+).*/\1/p'
}

# Ready means every edge connection is registered and the connector runs the installed version.
is_ready() {
  [ "$(ready_connections "$1")" = 4 ] && [ "$(running_version "$1")" = "$(installed_version)" ]
}

wait_until_ready() {
  local metrics=$1 deadline=$((SECONDS + READY_SECONDS))
  until is_ready "$metrics"; do
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
  require_safe_cloudflared
  if ! is_ready "$MAIN_METRICS"; then
    start_replica
    restart_main
  fi
  stop_replica
  echo "after: running $(running_version "$MAIN_METRICS"), installed $(installed_version)"
}

if [[ "${BASH_SOURCE[0]:-$0}" == "$0" ]]; then
  main
fi
