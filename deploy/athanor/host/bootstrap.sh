#!/usr/bin/env bash
# Prepare a fresh Ubuntu 24.04 box to run our shards: Docker and Compose, cloudflared for the tunnel, a firewall that
# admits only SSH, time sync, the /backup disk, the athanor.slice resource budget and /opt/athanor. Idempotent: running
# it again changes nothing that is already in place.
#
#   sudo OPERATOR=ubuntu deploy/athanor/host/bootstrap.sh
#
# Before running it, the operator formats the backup disk once, by hand, since formatting erases it:
#   sudo mkfs.ext4 -L backup /dev/<second NVMe>
# and writes the tunnel token the owner created to a root-only file:
#   sudo install -d -m 0700 /etc/cloudflared
#   sudo install -m 0600 /dev/stdin /etc/cloudflared/tunnel-token   (paste the token, then Ctrl-D)
set -euo pipefail

OPERATOR=${OPERATOR:?Name the operator account that owns /opt/athanor, e.g. OPERATOR=ubuntu}
HERE=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
BUN_VERSION=1.4.0
NODE_MAJOR=22

[ "$(id -u)" -eq 0 ] || { echo "Run as root" >&2; exit 1; }

install_packages() {
  install -d -m 0755 /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg -o /etc/apt/keyrings/cloudflare-main.gpg
  curl -fsSL "https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key" |
    gpg --dearmor --yes -o /etc/apt/keyrings/nodesource.gpg
  local codename
  codename=$(. /etc/os-release && echo "$VERSION_CODENAME")
  echo "deb [signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $codename stable" \
    > /etc/apt/sources.list.d/docker.list
  echo "deb [signed-by=/etc/apt/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main" \
    > /etc/apt/sources.list.d/cloudflared.list
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_$NODE_MAJOR.x nodistro main" \
    > /etc/apt/sources.list.d/nodesource.list
  apt-get update -q
  apt-get install -y -q docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin cloudflared \
    nodejs git python3 zstd jq curl unzip ufw
  corepack enable
  # The runner and harness run under bun as the operator.
  sudo -u "$OPERATOR" bash -c "curl -fsSL https://bun.sh/install | bash -s bun-v$BUN_VERSION"
}

# SSH is the only inbound service; the tunnel is outbound, and every shard port binds loopback.
configure_firewall() {
  ufw default deny incoming
  ufw default allow outgoing
  ufw allow OpenSSH
  ufw --force enable
}

configure_time() {
  timedatectl set-ntp true
}

mount_backup() {
  install -d -m 0700 /backup
  grep -q "^LABEL=backup " /etc/fstab || echo "LABEL=backup /backup ext4 defaults,nofail,noatime 0 2" >> /etc/fstab
  mountpoint -q /backup || mount /backup
}

# The runner reads the slice's cpuset.cpus.effective, which exists only when the slice names its CPUs.
install_slice() {
  install -m 0644 "$HERE/../systemd/athanor.slice" /etc/systemd/system/athanor.slice
  install -d -m 0755 /etc/systemd/system/athanor.slice.d
  printf '[Slice]\nAllowedCPUs=0-%d\n' "$(($(nproc) - 1))" > /etc/systemd/system/athanor.slice.d/10-cpus.conf
  systemctl daemon-reload
  systemctl start athanor.slice
}

# The isolated-stack lock and run directories live here.
create_workspace() {
  install -d -m 0755 -o "$OPERATOR" -g "$OPERATOR" /opt/athanor
}

install_tunnel() {
  [ -f /etc/cloudflared/tunnel-token ] || { echo "Write /etc/cloudflared/tunnel-token first" >&2; exit 1; }
  chmod 0600 /etc/cloudflared/tunnel-token
  install -m 0644 "$HERE/cloudflared.service" /etc/systemd/system/cloudflared.service
  systemctl daemon-reload
  systemctl enable --now cloudflared.service
}

install_packages
configure_firewall
configure_time
mount_backup
install_slice
create_workspace
install_tunnel
echo "Host ready: docker $(docker --version | cut -d' ' -f3 | tr -d ,), cloudflared $(cloudflared --version | cut -d' ' -f3)"
