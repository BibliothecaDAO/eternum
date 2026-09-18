#!/usr/bin/env bash
# Install the native workspace's tools without changing another stack's toolchain.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TOOLS_DIR="$(realpath -m "${1:?Usage: install-native-tools.sh INSTALL_DIRECTORY}")"
export ASDF_DIR="$TOOLS_DIR/asdf"
export ASDF_DATA_DIR="$TOOLS_DIR/data"
mkdir -p "$TOOLS_DIR"
if [ ! -d "$ASDF_DIR" ]; then
  git clone --depth 1 --branch v0.15.0 https://github.com/asdf-vm/asdf.git "$ASDF_DIR"
fi
# shellcheck disable=SC1091
source "$ASDF_DIR/asdf.sh"

if [ ! -d "$ASDF_DATA_DIR/plugins/scarb" ]; then
  asdf plugin add scarb https://github.com/software-mansion/asdf-scarb.git
fi
if [ ! -d "$ASDF_DATA_DIR/plugins/starknet-foundry" ]; then
  asdf plugin add starknet-foundry https://github.com/foundry-rs/asdf-starknet-foundry.git
fi

cd "$REPO_ROOT/contracts/l3/world-native"
asdf install
scarb_prefix="$(asdf where scarb)"
foundry_prefix="$(asdf where starknet-foundry)"
"$scarb_prefix/bin/scarb" --version
"$foundry_prefix/bin/snforge" --version
printf 'export PATH=%q:"$PATH"\n' "$scarb_prefix/bin:$foundry_prefix/bin" > "$TOOLS_DIR/env"
printf 'Native toolchain ready. Run: source %q\n' "$TOOLS_DIR/env"
