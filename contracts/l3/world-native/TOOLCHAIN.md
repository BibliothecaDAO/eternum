# Native contract toolchain

`.tool-versions` pins Scarb, Foundry and the Sierra compiler. For this package, snforge 0.64.0 also needs
`toolchain/library-call-rollback.patch`: failed library calls must restore the storage contract's class hash, not the
executed library's hash. Blockifier and Madara already behave correctly; the patch aligns the test runner.

Upstream fix: [starknet-foundry #4601](https://github.com/foundry-rs/starknet-foundry/pull/4601).

After installing the declared tools, build the corrected runner once and put it first on `PATH`:

```bash
bash contracts/l3/world-native/build-snforge.sh "$HOME/.local/share/eternum-native-tools/patched/bin"
export PATH="$HOME/.local/share/eternum-native-tools/patched/bin:$PATH"
```

The script pins Foundry's source commit and Rust 1.94.1. GitHub does not build or test this package: `scarb test` and
the landing gate `contracts/l3/check-native.sh` run on the machine that lands the pull request, with this runner.

Remove the patch and the build script when a released Foundry version includes the fix, and update `.tool-versions`.
Keep the failed-library-call regression when making that change.
