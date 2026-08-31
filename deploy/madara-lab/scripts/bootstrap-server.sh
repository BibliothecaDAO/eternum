#!/usr/bin/env bash
# Bootstrap a fresh Ubuntu box into the lab's server profile: Docker, the toolchain herald and the deployer need,
# the repo under /opt/realms, the Cloudflare Tunnel config, and the herald/web systemd units.
#
# Run as root on a fresh Ubuntu 24.04 LTS host:
#   LAB_DOMAIN=lab.example.com TUNNEL_ID=<uuid> bash bootstrap-server.sh
# with the tunnel credentials JSON (from `cloudflared tunnel create realms-lab` on the owner's machine) at
# /root/credentials.json before running. Idempotent: re-running updates what changed and leaves state alone.
#
# What it does not do: bring the chain up, deploy the world, or start herald — those are the README's
# "Server profile" steps, run as the realms user once the root .env exists.
set -euo pipefail

: "${LAB_DOMAIN:?set LAB_DOMAIN (the Cloudflare zone subtree, e.g. lab.example.com)}"
: "${TUNNEL_ID:?set TUNNEL_ID (from cloudflared tunnel create)}"
CREDENTIALS_JSON="${CREDENTIALS_JSON:-/root/credentials.json}"
REPO_URL="${REPO_URL:-https://github.com/BibliothecaDAO/eternum.git}"
REPO_BRANCH="${REPO_BRANCH:-feat/madara-lab}"
REPO_DIR=/opt/realms/eternum
LAB_DIR="$REPO_DIR/deploy/madara-lab"
PNPM_VERSION=10.25.0   # package.json "packageManager"
NODE_MAJOR=22

log() { printf '\n== %s\n' "$*"; }

install_packages() {
  log "apt packages"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -q
  apt-get install -y -q ca-certificates curl git jq ufw gettext-base unzip build-essential
}

install_docker() {
  if command -v docker >/dev/null && docker compose version >/dev/null 2>&1; then return; fi
  log "docker (official repository)"
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  # shellcheck disable=SC1091
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -q
  apt-get install -y -q docker-ce docker-ce-cli containerd.io docker-compose-plugin
}

install_node_toolchain() {
  if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" != "$NODE_MAJOR" ]; then
    log "node $NODE_MAJOR (NodeSource)"
    curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
    apt-get install -y -q nodejs
  fi
  if [ "$(pnpm --version 2>/dev/null || true)" != "$PNPM_VERSION" ]; then
    log "pnpm $PNPM_VERSION"
    npm install -g "pnpm@${PNPM_VERSION}"
  fi
}

create_realms_user() {
  if ! id realms >/dev/null 2>&1; then
    log "user realms"
    useradd -m -s /bin/bash realms
  fi
  usermod -aG docker realms
  install -d -o realms -g realms /opt/realms
}

install_user_toolchain() {
  # bun runs herald; asdf holds scarb/sozo for deploy-world.sh. Both live in the realms user's home.
  log "bun + asdf (scarb, sozo) for the realms user"
  sudo -u realms -H bash -s <<'EOS'
set -euo pipefail
# Start in a directory realms owns: sudo keeps the caller's CWD (/root or /home/ubuntu), which realms
# cannot read, and asdf.sh's cd-back then fails. HOME is realms' own and always accessible.
cd "$HOME"
if [ ! -x "$HOME/.bun/bin/bun" ]; then curl -fsSL https://bun.sh/install | bash; fi
if [ ! -d "$HOME/.asdf" ]; then
  git clone --depth 1 https://github.com/asdf-vm/asdf.git "$HOME/.asdf" --branch v0.15.0
  printf '\n. "$HOME/.asdf/asdf.sh"\nexport PATH="$HOME/.bun/bin:$PATH"\n' >> "$HOME/.bashrc"
fi
. "$HOME/.asdf/asdf.sh"
# deploy-world.sh needs scarb + sozo only (Madara is the docker sequencer, not katana; torii is gone).
# sozo is its own asdf plugin — the asdf-dojo bundle versions sozo by dojo release and has no 1.8.7.
asdf plugin add scarb https://github.com/software-mansion/asdf-scarb.git 2>/dev/null || true
asdf plugin add sozo  https://github.com/dojoengine/asdf-sozo.git 2>/dev/null || true
asdf install scarb 2.13.1
asdf install sozo 1.8.7
EOS
}

checkout_repo() {
  log "repository at $REPO_DIR ($REPO_BRANCH)"
  if [ ! -d "$REPO_DIR/.git" ]; then
    sudo -u realms git clone --branch "$REPO_BRANCH" "$REPO_URL" "$REPO_DIR"
  else
    sudo -u realms git -C "$REPO_DIR" fetch --quiet origin "$REPO_BRANCH"
    sudo -u realms git -C "$REPO_DIR" checkout --quiet "$REPO_BRANCH"
    sudo -u realms git -C "$REPO_DIR" pull --ff-only --quiet
  fi
}

render_tunnel_config() {
  log "cloudflared config for $LAB_DOMAIN"
  [ -f "$CREDENTIALS_JSON" ] || { echo "missing tunnel credentials at $CREDENTIALS_JSON" >&2; exit 2; }
  install -d -o realms -g realms "$LAB_DIR/.lab"
  install -d -o realms -g realms "$LAB_DIR/.lab/cloudflared"
  LAB_DOMAIN="$LAB_DOMAIN" TUNNEL_ID="$TUNNEL_ID" \
    envsubst '${LAB_DOMAIN} ${TUNNEL_ID}' < "$LAB_DIR/cloudflared/config.yml.template" \
    > "$LAB_DIR/.lab/cloudflared/config.yml"
  install -m 0600 -o realms -g realms "$CREDENTIALS_JSON" "$LAB_DIR/.lab/cloudflared/credentials.json"
  chown realms:realms "$LAB_DIR/.lab/cloudflared/config.yml"
  printf 'LAB_DOMAIN=%s\nTUNNEL_ID=%s\n' "$LAB_DOMAIN" "$TUNNEL_ID" > "$LAB_DIR/.env"
  chown realms:realms "$LAB_DIR/.env"
}

install_units() {
  log "systemd units (herald, web)"
  install -m 0644 "$LAB_DIR/systemd/herald.service" /etc/systemd/system/herald.service
  install -m 0644 "$LAB_DIR/systemd/web.service" /etc/systemd/system/web.service
  systemctl daemon-reload
  systemctl enable herald web >/dev/null
}

harden() {
  log "firewall: ssh only (every service is on localhost or behind the tunnel)"
  ufw --force reset >/dev/null
  ufw default deny incoming >/dev/null
  ufw default allow outgoing >/dev/null
  ufw allow OpenSSH >/dev/null
  ufw --force enable >/dev/null
}

main() {
  install_packages
  install_docker
  install_node_toolchain
  create_realms_user
  install_user_toolchain
  checkout_repo
  render_tunnel_config
  install_units
  harden
  log "done. Next, as realms: the README's 'Server profile' steps (root .env, pnpm install, chain up, world, herald)."
}

main "$@"
