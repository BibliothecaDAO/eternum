#!/usr/bin/env bash
# Issues the lab's wildcard certificate (realms.test, *.realms.test) into .lab/certs/ for Caddy.
#
#   deploy/madara-lab/scripts/issue-certs.sh
#
# The certificate comes from the mkcert root the game's Vite plugin keeps in ~/.vite-plugin-mkcert, so the one
# `mkcert -install` that trusts that root (system store + Brave/Chrome NSS db) covers Vite and Caddy alike.
set -euo pipefail

LAB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CERT_DIR="$LAB_DIR/.lab/certs"
export CAROOT="${CAROOT:-$HOME/.vite-plugin-mkcert}"

command -v mkcert >/dev/null || { echo "mkcert not found on PATH" >&2; exit 1; }
[[ -f "$CAROOT/rootCA.pem" ]] || {
  echo "no mkcert root in $CAROOT — start the game dev server once (it creates the root) or set CAROOT" >&2
  exit 1
}

mkdir -p "$CERT_DIR"
mkcert -cert-file "$CERT_DIR/realms.test.pem" -key-file "$CERT_DIR/realms.test-key.pem" realms.test '*.realms.test'
echo "==> certificates in $CERT_DIR (root: $CAROOT/rootCA.pem)"
echo "    if the browser does not trust them yet, run once:  CAROOT=$CAROOT mkcert -install"
