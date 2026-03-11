# Install Axis

## One-command Install

Latest release:

```bash
curl -fsSL https://github.com/bibliothecadao/eternum/releases/latest/download/install-axis.sh | bash
```

Pinned release:

```bash
curl -fsSL https://github.com/bibliothecadao/eternum/releases/latest/download/install-axis.sh | VERSION=v0.1.0 bash
```

The installer:

- detects supported targets (`darwin-arm64`, `darwin-x64`, `linux-x64`, `linux-arm64`)
- downloads the matching archive + `checksums.txt`
- verifies SHA-256 checksum
- installs to `~/.local/share/eternum-agent/<version>`
- links `axis` into `~/.local/bin`

## Optional Installer Overrides

```bash
curl -fsSL https://github.com/bibliothecadao/eternum/releases/latest/download/install-axis.sh | \
  VERSION=v0.1.0 BIN_DIR="$HOME/.local/bin" INSTALL_DIR="$HOME/.local/share/eternum-agent" bash
```

Advanced:

- `TARGET=linux-x64` to force a specific target
- `GITHUB_REPO=org/repo` to install from a fork

## Verify and Initialize

```bash
axis --version
axis init
axis doctor
```

## Rollback

Re-run installer with an older version:

```bash
curl -fsSL https://github.com/bibliothecadao/eternum/releases/latest/download/install-axis.sh | VERSION=v0.1.0 bash
```

Or re-point the symlink manually:

```bash
ln -sfn "$HOME/.local/share/eternum-agent/v0.1.0/axis/axis" "$HOME/.local/bin/axis"
```

## Uninstall

```bash
rm -f "$HOME/.local/bin/axis"
rm -rf "$HOME/.local/share/eternum-agent"
rm -rf "$HOME/.eternum-agent"
```
