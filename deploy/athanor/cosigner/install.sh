#!/usr/bin/env bash
# Installs the independent payout co-signer on this box, as deploy/athanor/README.md describes. Run as the box's sudo
# operator; each step checks before it acts, so a rerun after a crash reaches the same end.
#
#   prepare REVISION   its user, Bun at /usr/local/bin, /opt/eternum at REVISION with dependencies and package builds,
#                      and its key. Prints only {"publicKey": ...}, which setup takes as cosignerPublicKey.
#                      Run before /opt/eternum exists by piping this file: ssh BOX 'bash -s -- prepare REVISION' < install.sh
#   start              reads config.json on standard input (it holds tokens and the L2 endpoint, so never an argument),
#                      writes it mode 0600, starts the unit and prints the co-signer's /health.
set -euo pipefail
# Empty on the box; the installer's test runs this script under a temporary root with stand-in system commands.
ROOT=${PAYOUT_COSIGNER_ROOT:-}
USER_NAME=payout-cosigner
CHECKOUT=$ROOT/opt/eternum
SETTINGS=$ROOT/etc/payout-cosigner
LOG=$ROOT/var/log/payout-cosigner-install.log
BUN=$ROOT/usr/local/bin/bun

# One install step, its output in the log. Any failure ends the install and names the step: a failed fetch or checkout
# can never let the install finish on the revision that was there before.
step() {
  "$@" >>"$LOG" 2>&1 || { echo "Co-signer install failed at: $*; see $LOG on the box" >&2; exit 1; }
}

prepare() {
  local revision=$1
  [[ $revision =~ ^[0-9a-f]{40}$ ]] || { echo "prepare needs a 40-character commit" >&2; exit 1; }
  id "$USER_NAME" >/dev/null 2>&1 || sudo useradd --system --home-dir /nonexistent --shell /usr/sbin/nologin "$USER_NAME"
  [ -x "$BUN" ] || sudo install -m 0755 "$HOME/.bun/bin/bun" "$BUN"
  sudo install -d -m 0755 -o "$(id -un)" -g "$(id -gn)" "$CHECKOUT"
  [ -f "$LOG" ] || sudo install -m 0600 -o "$(id -un)" -g "$(id -gn)" /dev/null "$LOG"
  [ -d "$CHECKOUT/.git" ] || step git clone --no-checkout https://github.com/BibliothecaDAO/eternum.git "$CHECKOUT"
  step git -C "$CHECKOUT" fetch origin "$revision"
  step git -C "$CHECKOUT" checkout --detach "$revision"
  [ "$(git -C "$CHECKOUT" rev-parse HEAD)" = "$revision" ] || { echo "$CHECKOUT is not at $revision" >&2; exit 1; }
  step pnpm --dir "$CHECKOUT" install --frozen-lockfile
  step pnpm --dir "$CHECKOUT" run build:packages
  sudo install -d -m 0700 -o "$USER_NAME" -g "$USER_NAME" "$SETTINGS"
  sudo -u "$USER_NAME" "$BUN" "$CHECKOUT/deploy/athanor/cosigner/main.ts" init-key "$SETTINGS/key"
}

start() {
  local config port
  config=$(cat)
  port=$(python3 -c 'import json,sys; print(int(json.loads(sys.stdin.read())["port"]))' <<<"$config")
  sudo install -m 0600 -o "$USER_NAME" -g "$USER_NAME" /dev/stdin "$SETTINGS/config.json" <<<"$config"
  sudo install -m 0644 "$CHECKOUT/deploy/athanor/cosigner/payout-cosigner.service" "$ROOT/etc/systemd/system/payout-cosigner.service"
  sudo systemctl daemon-reload
  sudo systemctl enable --quiet payout-cosigner.service
  sudo systemctl restart payout-cosigner.service
  for _ in $(seq 30); do
    if curl -fsS "http://127.0.0.1:$port/health" 2>/dev/null; then echo; return; fi
    sleep 1
  done
  echo "The co-signer did not answer on 127.0.0.1:$port; see journalctl -u payout-cosigner" >&2
  exit 1
}

case "${1:-}" in
  prepare) prepare "${2:-}" ;;
  start) start ;;
  *) echo "usage: install.sh prepare REVISION | start < config.json" >&2; exit 1 ;;
esac
