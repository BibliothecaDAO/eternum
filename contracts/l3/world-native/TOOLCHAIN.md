# Native contract toolchain

`.tool-versions` pins Scarb, Foundry and the Sierra compiler. For this package, snforge 0.64.0 also needs
`toolchain/library-call-rollback.patch`: failed library calls must restore the storage contract's class hash, not the
executed library's hash. Blockifier and Madara already behave correctly; the patch aligns the test runner.

Upstream fix: [starknet-foundry #4601](https://github.com/foundry-rs/starknet-foundry/pull/4601).

After installing the declared tools, build the same runner CI uses:

```bash
bash contracts/l3/world-native/build-snforge.sh "$HOME/.local/share/eternum-native-tools/patched/bin"
export PATH="$HOME/.local/share/eternum-native-tools/patched/bin:$PATH"
(cd contracts/l3/world-native && scarb test)
```

The script pins Foundry's source commit and Rust 1.94.1. The existing native-world job caches only the resulting binary,
keyed by runner OS/architecture and the hashes of the patch, build script and version file. Cache misses build once;
cache hits use that binary directly.

Remove the patch, build script and cache step when a released Foundry version includes the fix, update `.tool-versions`,
and restore the stock runner install in native-world. Keep the failed-library-call regression when making that change.
