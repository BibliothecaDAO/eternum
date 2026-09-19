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
asdf install scarb
asdf install starknet-foundry
scarb_prefix="$(asdf where scarb)"
foundry_prefix="$(asdf where starknet-foundry)"
usc_version="$(awk '$1 == "universal-sierra-compiler" { print $2 }' .tool-versions)"
test -n "$usc_version"
usc_prefix="$TOOLS_DIR/universal-sierra-compiler/$usc_version"
if [ ! -x "$usc_prefix/bin/universal-sierra-compiler" ]; then
  case "$(uname -sm)" in
    'Linux x86_64') usc_target=x86_64-unknown-linux-gnu ;;
    'Linux aarch64') usc_target=aarch64-unknown-linux-gnu ;;
    *) echo 'Native box provisioning requires Linux x86_64 or aarch64' >&2; exit 1 ;;
  esac
  usc_archive="universal-sierra-compiler-v$usc_version-$usc_target"
  mkdir -p "$usc_prefix/bin"
  curl --fail --location --retry 3 \
    "https://github.com/software-mansion/universal-sierra-compiler/releases/download/v$usc_version/$usc_archive.tar.gz" \
    | tar -xz --strip-components=2 -C "$usc_prefix/bin" "$usc_archive/bin/universal-sierra-compiler"
fi
"$scarb_prefix/bin/scarb" --version
"$foundry_prefix/bin/snforge" --version
"$usc_prefix/bin/universal-sierra-compiler" --version
printf 'export PATH=%q:"$PATH"\n' "$scarb_prefix/bin:$foundry_prefix/bin:$usc_prefix/bin" > "$TOOLS_DIR/env"
printf 'Native toolchain ready. Run: source %q\n' "$TOOLS_DIR/env"
