# Native contract toolchain

The world runner is built from Foundry 0.64.0 at commit `ab78eeeb51a991ffd4b65e7be30b8791009066d5`, with the patches in
`toolchain/`:

- `library-call-rollback.patch` restores the storage contract's class hash after a failed library call, matching
  Blockifier and Madara. Upstream fix:
  [starknet-foundry #4601](https://github.com/foundry-rs/starknet-foundry/pull/4601).
- `test-memory.patch` bounds artifact/summary retention and prepares one test package at a time.
- `transaction-events.patch` gives each test-level contract call its own event budget. Nested calls share that budget;
  retained events keep their order across transactions. The chain's event limit is unchanged.

An upstream or older patched binary also prints `snforge 0.64.0`; its version alone is insufficient.

## Setup

On Linux, install Python 3.11+, Git, rustup, a C compiler/linker, pkg-config, and the system OpenSSL development
headers/libraries (for example `build-essential pkg-config libssl-dev` on Debian/Ubuntu). Install the Scarb and Sierra
compiler versions in `.tool-versions`. The builder installs Rust 1.94.1 and explicitly sets `OPENSSL_NO_VENDOR=1`; no
external environment override or vendored OpenSSL/Perl build is required.

From the repository root:

```bash
bash contracts/l3/world-native/build-snforge.sh
```

The command prints the installed binary's absolute path. It keys the installation by the pinned source, all patch
contents, Rust version, `.tool-versions`, platform and build options, under
`${XDG_DATA_HOME:-$HOME/.local/share}/eternum-native-tools/snforge/`. A manifest records those inputs and the binary's
SHA-256. Repeating setup verifies the existing binary and returns without cloning or compiling. Changed inputs select a
new installation. An invalid existing installation is rebuilt.

Build scratch and Cargo output live under `${XDG_CACHE_HOME:-$HOME/.cache}/eternum-native-tools/`; an existing
`CARGO_TARGET_DIR` can supply a dependency cache. The builder uses two Cargo jobs, disables release LTO and uses 16
codegen units. It copies the candidate to a temporary file on the destination filesystem, validates its version and
hash, and renames it into place. Failed build, copy or validation leaves the previous binary intact. If interrupted
between binary and manifest publication, resolution refuses the incomplete installation; rerunning setup repairs it.

## Run tests and record fixtures

```bash
(cd contracts/l3/world-native && scarb test)
bash contracts/l3/check-native.sh
```

Both entrypoints resolve and verify the required installation before starting expensive work, regardless of `snforge` on
`PATH`. A missing or stale installation stops with the rebuild command. The landing gate uses this runner for the native
verifier too; the ledger keeps its separate toolchain. GitHub does not build or test the world package.

Use the same entrypoint for ignored fixture producers, for example from the repository root:

```bash
bash contracts/l3/test-native.sh record_spatial_replay --ignored
bash contracts/l3/test-native.sh record_frontier_combat_exchanges --ignored
python3 contracts/l3/world-native/scripts/generate-lords-budget-fixtures.py
```

The budget producer uses the same resolver before writing checkpoint input. Direct `snforge test` calls bypass these
checks and are not the supported world test or fixture-recording path.

The landing gate runs the lightweight installation regression tests. Run them alone with:

```bash
python3 -m unittest discover -s contracts/l3/world-native/toolchain -p 'test_snforge.py'
```

The lifecycle suite checks that two separate 600-event calls preserve all 1,200 rows in order. The gate also runs two
deliberately failing, ignored probes: one 1,001-event call and one outer call containing two nested 600-event calls.
Both must fail at the unchanged 1,000-event limit. Run the complete boundary check with retained logs:

```bash
python3 contracts/l3/world-native/toolchain/check_transaction_events.py --out /tmp/native-event-evidence
```

When a released Foundry version includes these fixes, remove the patches and custom build/resolution together, migrate
the entrypoints, and update `.tool-versions`. Keep the rollback and memory regressions.
