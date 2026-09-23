# Herald Poseidon (WebAssembly)

`src/lib.rs` is the source: Starknet Poseidon (`starknet-crypto` 0.8.1) behind a raw C ABI, built for
`wasm32-unknown-unknown` with the toolchain pinned in `rust-toolchain.toml`. `./build.sh` compiles it and writes the
module, base64-encoded, to `../src/native/poseidon-wasm.gen.ts`, which is committed. CI and the Herald image never need
Rust. Rebuild only when `src/lib.rs`, `Cargo.toml` or `Cargo.lock` change; the generated header records the module's
sha256.

Herald derives every native entity id through it (`src/native/entity-id.ts`). The test `src/native/entity-id.test.ts`
checks it against 313 ids from a real batch receipt, as starknet.js computed them.
