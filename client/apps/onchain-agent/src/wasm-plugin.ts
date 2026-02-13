/**
 * Bun build plugin that embeds wasm-bindgen WASM modules.
 *
 * Problem: Bun's bundler treats `.wasm` imports as file assets (returning a
 * path string) instead of WASM module exports. wasm-bindgen glue code does
 * `import * as wasm from "./foo_bg.wasm"` expecting the WASM instance
 * exports, then calls `__wbg_set_wasm(wasm)` to wire them in.
 *
 * Solution: This plugin intercepts the 4-line wasm-bindgen entry files
 * (e.g. `account_wasm.js`, `session_wasm.js`) and rewrites them to:
 * 1. Import the _bg.js glue (which exports the JS functions the WASM needs)
 * 2. Embed the .wasm bytes as base64
 * 3. Synchronously compile and instantiate the WASM with the glue as imports
 * 4. Call __wbg_set_wasm with the real WASM instance exports
 */

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import type { BunPlugin } from "bun";

export const wasmPlugin: BunPlugin = {
  name: "wasm-bindgen-embed",
  setup(build) {
    // Intercept the wasm-bindgen entry JS files that import .wasm
    // Pattern: they contain `import * as wasm from "./<name>_bg.wasm"`
    build.onLoad({ filter: /controller-wasm\/pkg-[^/]+\/\w+_wasm\.js$/ }, (args) => {
      const source = readFileSync(args.path, "utf8");

      // Check if this is a wasm-bindgen entry file (4 lines: import wasm, re-export, import set_wasm, call set_wasm)
      const wasmImportMatch = source.match(/import \* as wasm from ["'](.\/[^"']+\.wasm)["']/);
      if (!wasmImportMatch) {
        return undefined; // Not a wasm-bindgen entry, let default loader handle it
      }

      const wasmRelPath = wasmImportMatch[1]; // e.g. "./account_wasm_bg.wasm"
      const wasmAbsPath = path.resolve(path.dirname(args.path), wasmRelPath);
      const bgJsRelPath = wasmRelPath.replace(/\.wasm$/, ".js"); // e.g. "./account_wasm_bg.js"

      if (!existsSync(wasmAbsPath)) {
        return undefined;
      }

      const wasmBytes = readFileSync(wasmAbsPath);
      const b64 = wasmBytes.toString("base64");

      // Generate replacement: import glue, embed bytes, instantiate, set wasm
      const code = `
import * as glue from ${JSON.stringify(bgJsRelPath)};
export * from ${JSON.stringify(bgJsRelPath)};
import { __wbg_set_wasm } from ${JSON.stringify(bgJsRelPath)};

const bytes = Uint8Array.from(atob(${JSON.stringify(b64)}), c => c.charCodeAt(0));
const mod = new WebAssembly.Module(bytes);
const instance = new WebAssembly.Instance(mod, {
  ${JSON.stringify(bgJsRelPath)}: glue,
});
__wbg_set_wasm(instance.exports);
`;

      return {
        contents: code,
        loader: "js",
      };
    });
  },
};
