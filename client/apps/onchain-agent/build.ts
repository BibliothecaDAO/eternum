/**
 * Bundle onchain-agent with the wasm-bindgen embed plugin.
 *
 * Usage:
 *   bun run build.ts              # bundle only (dist-bun/cli.js)
 *   bun run build.ts --compile    # bundle + compile standalone binary (./axis)
 */

import { wasmPlugin } from "./src/wasm-plugin";

const args = process.argv.slice(2);
const compile = args.includes("--compile");

const result = await Bun.build({
  entrypoints: ["./src/cli.ts"],
  outdir: "./dist-bun",
  target: "bun",
  plugins: [wasmPlugin],
});

if (!result.success) {
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}

console.log(`Bundled ${result.outputs.length} file(s) to dist-bun/`);

if (compile) {
  console.log("Compiling binary...");
  const proc = Bun.spawnSync(["bun", "build", "./dist-bun/cli.js", "--compile", "--outfile", "axis"], {
    cwd: import.meta.dir,
    stdio: ["inherit", "inherit", "inherit"],
  });
  process.exit(proc.exitCode ?? 0);
}
