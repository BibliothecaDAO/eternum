import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, renameSync } from "node:fs";
import { extname, join, relative, resolve, sep } from "node:path";
import type { Plugin } from "vite";

const HASH_LENGTH = 12;

/**
 * Each model file under `public/models`, by the URL the code asks for (`/models/realms/city.glb`), with the URL a build
 * serves it at: the same name carrying the first hex of its content's SHA-256 (`/models/realms/city.1f2e3d4c5b6a.glb`).
 * A changed model is a new URL, so every model can be cached for good.
 */
function hashedModelUrls(modelsDirectory: string): Record<string, string> {
  const urls: Record<string, string> = {};
  const walk = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(file);
        continue;
      }
      const url = `/models/${relative(modelsDirectory, file).split(sep).join("/")}`;
      const hash = createHash("sha256").update(readFileSync(file)).digest("hex").slice(0, HASH_LENGTH);
      const extension = extname(url);
      urls[url] = `${url.slice(0, url.length - extension.length)}.${hash}${extension}`;
    }
  };
  if (existsSync(modelsDirectory)) walk(modelsDirectory);
  return urls;
}

/** Renames each copied model in the build's output to its hashed name; a file already renamed is left as it is. */
function renameHashedModels(outputDirectory: string, urls: Record<string, string>): void {
  for (const [url, hashed] of Object.entries(urls)) {
    const from = join(outputDirectory, url);
    if (existsSync(from)) renameSync(from, join(outputDirectory, hashed));
  }
}

/**
 * The build serves models at content-hashed URLs: the client reads the map as `__MODEL_URLS__` (three/utils/model-url.ts)
 * and the output holds only the hashed files, so `public/_headers` can cache `/models/*` as immutable. In development
 * and tests the map is absent and each model keeps its own URL.
 */
export function hashedModels(): Plugin {
  let urls: Record<string, string> = {};
  let outputDirectory = "";
  return {
    name: "hashed-models",
    apply: "build",
    config(config) {
      urls = hashedModelUrls(resolve(config.root ?? process.cwd(), "public/models"));
      return { define: { __MODEL_URLS__: JSON.stringify(urls) } };
    },
    configResolved(config) {
      outputDirectory = resolve(config.root, config.build.outDir);
    },
    writeBundle() {
      renameHashedModels(outputDirectory, urls);
    },
  };
}
