/**
 * Bun build plugins for producing a standalone binary.
 *
 * 1. wasmPlugin — embeds wasm-bindgen WASM modules as base64
 * 2. piConfigPlugin — patches pi-coding-agent config to not read package.json from disk
 */

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import type { BunPlugin } from "bun";

/**
 * Embeds wasm-bindgen WASM modules into the bundle.
 *
 * Bun's bundler treats `.wasm` imports as file assets (path strings).
 * This plugin intercepts the wasm-bindgen entry JS files and replaces
 * them with code that embeds the WASM bytes and instantiates them
 * synchronously with the sibling _bg.js glue as the import object.
 */
export const wasmPlugin: BunPlugin = {
  name: "wasm-bindgen-embed",
  setup(build) {
    build.onLoad({ filter: /controller-wasm\/pkg-[^/]+\/\w+_wasm\.js$/ }, (args) => {
      const source = readFileSync(args.path, "utf8");

      const wasmImportMatch = source.match(/import \* as wasm from ["'](.\/[^"']+\.wasm)["']/);
      if (!wasmImportMatch) {
        return undefined;
      }

      const wasmRelPath = wasmImportMatch[1];
      const wasmAbsPath = path.resolve(path.dirname(args.path), wasmRelPath);
      const bgJsRelPath = wasmRelPath.replace(/\.wasm$/, ".js");

      if (!existsSync(wasmAbsPath)) {
        return undefined;
      }

      const wasmBytes = readFileSync(wasmAbsPath);
      const b64 = wasmBytes.toString("base64");

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

      return { contents: code, loader: "js" };
    });
  },
};

/**
 * Patches pi-coding-agent's config.js to embed package.json data.
 *
 * The config module reads package.json from disk relative to the module
 * location, which fails in a standalone binary. This plugin replaces the
 * readFileSync call with a static JSON string read at build time.
 */
export function createPiConfigPlugin(packageJsonPath: string): BunPlugin {
  const pkgJson = readFileSync(packageJsonPath, "utf8");

  return {
    name: "pi-config-embed",
    setup(build) {
      build.onLoad({ filter: /pi-coding-agent\/dist\/config\.js$/ }, (args) => {
        let source = readFileSync(args.path, "utf8");

        // Replace: const pkg = JSON.parse(readFileSync(getPackageJsonPath(), "utf-8"));
        // With:    const pkg = <embedded package.json>;
        source = source.replace(
          /const pkg = JSON\.parse\(readFileSync\(getPackageJsonPath\(\),\s*"utf-8"\)\);/,
          `const pkg = ${pkgJson};`,
        );

        return { contents: source, loader: "js" };
      });
    },
  };
}
