import { wasmPlugin } from "./src/wasm-plugin";

const args = process.argv.slice(2);
const compile = args.includes("--compile");

if (compile) {
  // Two-step: bundle with plugin first, then compile the bundle
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

  console.log("Bundle complete, compiling binary...");

  // Compile the bundled JS into a standalone binary
  const proc = Bun.spawnSync(["bun", "build", "./dist-bun/cli.js", "--compile", "--outfile", "axis"], {
    cwd: import.meta.dir,
    stdio: ["inherit", "inherit", "inherit"],
  });

  process.exit(proc.exitCode ?? 0);
} else {
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

  console.log(`Built ${result.outputs.length} files`);
}
