#!/usr/bin/env bash
set -euo pipefail

# Builds the pinned runner with correct library rollback and bounded test-artifact/summary memory.
output=$(realpath -m "${1:?Usage: build-snforge.sh OUTPUT_BIN_DIRECTORY}")
package=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
build=$(mktemp -d)
trap 'rm -rf -- "$build"' EXIT

rustup toolchain install 1.94.1 --profile minimal
git clone --depth 1 --branch v0.64.0 https://github.com/foundry-rs/starknet-foundry.git "$build/source"
test "$(git -C "$build/source" rev-parse HEAD)" = ab78eeeb51a991ffd4b65e7be30b8791009066d5
git -C "$build/source" apply "$package/toolchain/library-call-rollback.patch"
git -C "$build/source" apply "$package/toolchain/test-memory.patch"
CARGO_PROFILE_RELEASE_LTO=false CARGO_PROFILE_RELEASE_CODEGEN_UNITS=16 \
  cargo +1.94.1 build --manifest-path "$build/source/Cargo.toml" --locked --release --bin snforge -j 2
mkdir -p -- "$output"
install -m 755 "$build/source/target/release/snforge" "$output/snforge"
"$output/snforge" --version
