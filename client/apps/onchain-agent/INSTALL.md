# Install Eternum Agent

## One-command Install

Latest release:

```bash
curl -fsSL https://github.com/bibliothecadao/eternum/releases/latest/download/install-onchain-agent.sh | bash
```

Pinned release:

```bash
curl -fsSL https://github.com/bibliothecadao/eternum/releases/latest/download/install-onchain-agent.sh | VERSION=v0.1.0 bash
```

The installer:

- detects supported targets (`darwin-arm64`, `darwin-x64`, `linux-x64`, `linux-arm64`)
- downloads the matching archive + `checksums.txt`
- verifies SHA-256 checksum
- installs to `~/.local/share/eternum-agent/<version>`
- links `eternum-agent` into `~/.local/bin`

## Optional Installer Overrides

```bash
curl -fsSL https://github.com/bibliothecadao/eternum/releases/latest/download/install-onchain-agent.sh | \
  VERSION=v0.1.0 BIN_DIR="$HOME/.local/bin" INSTALL_DIR="$HOME/.local/share/eternum-agent" bash
```

Advanced:

- `TARGET=linux-x64` to force a specific target
- `GITHUB_REPO=org/repo` to install from a fork

## Verify and Initialize

```bash
eternum-agent --version
eternum-agent init
eternum-agent doctor
```

## Rollback

Re-run installer with an older version:

```bash
curl -fsSL https://github.com/bibliothecadao/eternum/releases/latest/download/install-onchain-agent.sh | VERSION=v0.1.0 bash
```

Or re-point the symlink manually:

```bash
ln -sfn "$HOME/.local/share/eternum-agent/v0.1.0/eternum-agent/eternum-agent" "$HOME/.local/bin/eternum-agent"
```

## Uninstall

```bash
rm -f "$HOME/.local/bin/eternum-agent"
rm -rf "$HOME/.local/share/eternum-agent"
rm -rf "$HOME/.eternum-agent"
```
