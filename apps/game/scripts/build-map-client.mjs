// Builds the map client's renderer (the `map-client` crate) into `src/map-client/renderer`: the module the page
// loads, its wrapper and its declarations, which are committed. The build is pinned so the same sources give the same
// bytes on any machine: Rust by `map-client/rust-toolchain.toml`, the crates by `Cargo.lock` (`--locked`), wasm-pack
// by the version below, and the paths the compiler writes into the module by remapping them.
//
//   pnpm --dir apps/game build:map-client
import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const WASM_PACK_VERSION = "0.15.0";

const game = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const crate = join(game, "map-client");
const out = join(game, "src", "map-client", "renderer");

const found = execFileSync("wasm-pack", ["--version"], { encoding: "utf8" }).trim();
if (found !== `wasm-pack ${WASM_PACK_VERSION}`) {
  console.error(`This build needs wasm-pack ${WASM_PACK_VERSION}; found "${found}".`);
  console.error(`Install it with: cargo install wasm-pack --version ${WASM_PACK_VERSION} --locked`);
  process.exit(1);
}

const cargoHome = process.env.CARGO_HOME ?? join(homedir(), ".cargo");
const remapped = [`${cargoHome}=/cargo`, `${crate}=/map-client`].map((pair) => `--remap-path-prefix=${pair}`);
execFileSync("wasm-pack", ["build", crate, "--target", "web", "--no-pack", "--out-dir", out, "--", "--locked"], {
  stdio: "inherit",
  env: { ...process.env, RUSTFLAGS: remapped.join(" ") },
});
rmSync(join(out, ".gitignore"), { force: true });
