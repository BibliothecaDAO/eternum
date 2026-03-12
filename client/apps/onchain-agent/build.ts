/**
 * Bun build script for compiling the onchain-agent into a standalone binary.
 *
 * Includes a plugin that fixes wasm-bindgen WASM imports for compiled binaries.
 * The default Bun bundler breaks the `import * as wasm from "*.wasm"` pattern
 * that wasm-bindgen uses. This plugin intercepts the glue entry files and
 * replaces the static WASM import with a lazy instantiation that properly
 * passes the JS imports to the WASM module.
 *
 * Usage:
 *   bun run build.ts
 */

import type { BunPlugin } from "bun";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";

// Read our package.json at build time so we can inject values into pi-agent's config
const pkg = JSON.parse(readFileSync("./package.json", "utf-8"));

const piConfigPlugin: BunPlugin = {
  name: "pi-config-fix",
  setup(build) {
    // Intercept pi-coding-agent's config.js which does:
    //   const pkg = JSON.parse(readFileSync(getPackageJsonPath(), "utf-8"));
    //   export const APP_NAME = pkg.piConfig?.name || "pi";
    //   export const CONFIG_DIR_NAME = pkg.piConfig?.configDir || ".pi";
    //   export const VERSION = pkg.version;
    // Replace with hardcoded values so no package.json is needed at runtime.
    build.onLoad({ filter: /pi-coding-agent\/dist\/config\.js$/ }, async (args) => {
      let source = readFileSync(args.path, "utf-8");

      // Replace the readFileSync line with a hardcoded object
      const embeddedPkg = JSON.stringify({
        name: pkg.name,
        version: pkg.version,
        piConfig: pkg.piConfig,
      });
      source = source.replace(
        /const pkg\s*=\s*JSON\.parse\(readFileSync\(getPackageJsonPath\(\),\s*"utf-8"\)\);/,
        `const pkg = ${embeddedPkg};`,
      );

      return { contents: source, loader: "js" };
    });
  },
};

const wasmPlugin: BunPlugin = {
  name: "wasm-bindgen-fix",
  setup(build) {
    // Intercept the wasm-bindgen entry files (session_wasm.js, account_wasm.js)
    // and replace the `import * as wasm from "./*_bg.wasm"` with lazy init.
    build.onLoad({ filter: /_(wasm|bg)\.wasm$/ }, async (args) => {
      const wasmBytes = readFileSync(args.path);
      const b64 = wasmBytes.toString("base64");

      // Parse the WASM to discover its exports and imports
      const wasmModule = new WebAssembly.Module(wasmBytes);
      const wasmExports = WebAssembly.Module.exports(wasmModule).map((e) => e.name);
      const wasmImports = WebAssembly.Module.imports(wasmModule);

      // Group imports by module
      const importModules = new Set(wasmImports.map((i) => i.module));

      // Generate named exports that proxy to the lazily-instantiated WASM
      const namedExports = wasmExports
        .filter((name) => /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name))
        .map((name) => `export function ${name}(...args) { return _exports.${name}(...args); }`)
        .join("\n");

      // For memory and other non-function exports, use getters
      const contents = `
let _exports = null;
const _wasmBytes = Uint8Array.from(atob(${JSON.stringify(b64)}), c => c.charCodeAt(0));

export function __wbg_init_wasm(imports) {
  if (_exports) return _exports;
  const mod = new WebAssembly.Module(_wasmBytes);
  const instance = new WebAssembly.Instance(mod, imports);
  _exports = instance.exports;
  return _exports;
}

// Proxy object — wasm-bindgen glue calls __wbg_set_wasm(wasm) with this
const proxy = new Proxy({}, {
  get(_, prop) {
    if (prop === '__wbg_init_wasm') return __wbg_init_wasm;
    if (!_exports) throw new Error('WASM not initialized. Call __wbg_init_wasm first.');
    return _exports[prop];
  },
  has(_, prop) {
    if (!_exports) return false;
    return prop in _exports;
  }
});

export default proxy;
`;
      return { contents, loader: "js" };
    });

    // Intercept the wasm-bindgen entry JS that does the import + set_wasm
    // Pattern: session_wasm.js or account_wasm.js
    build.onLoad({ filter: /(session_wasm|account_wasm)\.js$/ }, async (args) => {
      const source = readFileSync(args.path, "utf-8");

      // Only intercept files that match the wasm-bindgen pattern
      if (!source.includes("__wbg_set_wasm")) return undefined;

      const dir = dirname(args.path);

      // Detect which bg files we need
      const wasmImportMatch = source.match(/from\s+["']\.\/(\S+_bg\.wasm)["']/);
      const bgJsMatch = source.match(/from\s+["']\.\/(\S+_bg\.js)["']/);

      if (!wasmImportMatch || !bgJsMatch) return undefined;

      const bgWasmFile = wasmImportMatch[1];
      const bgJsFile = bgJsMatch[1];
      const bgWasmPath = join(dir, bgWasmFile);

      // Read the WASM to discover what JS imports it needs
      const wasmBytes = readFileSync(bgWasmPath);
      const wasmModule = new WebAssembly.Module(wasmBytes);
      const wasmImports = WebAssembly.Module.imports(wasmModule);
      const importModules = [...new Set(wasmImports.map((i) => i.module))];

      // The wasm-bindgen WASM typically imports from one module: the _bg.js file
      // We need to:
      // 1. Import the _bg.js glue (which has __wbg_set_wasm and all __wbg_* functions)
      // 2. Import the WASM bytes (now as our proxy from the .wasm onLoad above)
      // 3. Instantiate the WASM with the JS glue as imports
      // 4. Call __wbg_set_wasm with the instance exports

      // Extract the re-exports from the original file
      const reExportMatch = source.match(/export\s*\{([^}]+)\}\s*from\s*["']\.\/\S+_bg\.js["']/);
      const reExports = reExportMatch ? reExportMatch[1].trim() : "";

      const b64 = wasmBytes.toString("base64");

      const contents = `
import * as bgJs from "./${bgJsFile}";

// Decode embedded WASM
const _wasmBytes = Uint8Array.from(atob(${JSON.stringify(b64)}), c => c.charCodeAt(0));

// Build the import object the WASM expects
const importObject = {};
${importModules
  .map((mod) => {
    // The import module name in the WASM is the relative path like "./session_wasm_bg.js"
    // Map it to our bgJs import
    return `importObject[${JSON.stringify(mod)}] = bgJs;`;
  })
  .join("\n")}

// Instantiate and wire up
const wasmModule = new WebAssembly.Module(_wasmBytes);
const wasmInstance = new WebAssembly.Instance(wasmModule, importObject);
bgJs.__wbg_set_wasm(wasmInstance.exports);

// Re-export everything from the bg.js
export { ${reExports} } from "./${bgJsFile}";
`;

      return { contents, loader: "js" };
    });
  },
};

const result = await Bun.build({
  entrypoints: ["./src/entry/index.ts"],
  compile: {
    outfile: "./dist/onchain-agent",
  },
  plugins: [piConfigPlugin, wasmPlugin],
});

if (!result.success) {
  console.error("Build failed:");
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}

console.log("Build succeeded:", result.outputs[0]?.path);
