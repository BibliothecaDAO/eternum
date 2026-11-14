// Proves on a production build that a page which does not ask for the map client under trial loads none of it.
// The build's source maps tell what each chunk holds. The trial's code must sit in chunks of its own, with nothing
// else of the app in them, and those chunks may be reached only from each other or, on request, from the chunk that
// holds the trial's loader. A trial module bundled into a chunk the game loads anyway fails the check, and so does
// any static import of a trial chunk from the rest of the app.
//
//   pnpm --dir apps/game check:map-client-isolation
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** The trial's sources the rest of the app may hold: the flag's parser, and the loader of the rest. */
const OUTSIDE_THE_TRIAL = ["map-client-flag.ts", "lazy-map-renderer.ts"];
const LOADER = "lazy-map-renderer.ts";
const isTrial = (source) =>
  /\/src\/map-client\//.test(source) && !OUTSIDE_THE_TRIAL.some((name) => source.endsWith(`/${name}`));
const isOfTheApp = (source) => !source.includes("node_modules") && !/\/src\/map-client\//.test(source);

/** Every chunk of a build: its name, the sources its map names, and the chunks it imports, by how. */
export function readChunks(dist) {
  const assets = join(dist, "assets");
  return readdirSync(assets)
    .filter((name) => name.endsWith(".js"))
    .map((name) => {
      const code = readFileSync(join(assets, name), "utf8");
      const map = join(assets, `${name}.map`);
      const imports = (pattern) => [...code.matchAll(pattern)].map((match) => basename(match[1]));
      return {
        name,
        sources: existsSync(map) ? JSON.parse(readFileSync(map, "utf8")).sources : null,
        // A static import names its chunk after `from` or right after `import`; a dynamic one is a call.
        statics: imports(/(?:\bfrom|\bimport)\s*["']\.{1,2}\/([^"']+\.js)["']/g),
        dynamics: imports(/\bimport\(\s*["']\.{1,2}\/([^"']+\.js)["']/g),
      };
    });
}

/** How the build lets the trial reach a page that did not ask for it: one line for each way, none when it cannot. */
export function trialLeaks(dist) {
  // A file with no source map is not a chunk of the app's code: the build copies decoders in as they are.
  const chunks = readChunks(dist).filter((chunk) => chunk.sources !== null);
  const trial = new Set(chunks.filter((chunk) => chunk.sources.some(isTrial)).map((chunk) => chunk.name));
  if (trial.size === 0) return ["No chunk holds the map client under trial: the check has nothing to judge"];
  const leaks = [];
  for (const chunk of chunks) {
    const holdsLoader = chunk.sources.some((source) => source.endsWith(`/${LOADER}`));
    if (trial.has(chunk.name)) {
      for (const source of chunk.sources.filter(isOfTheApp))
        leaks.push(`${chunk.name}: holds the trial beside ${source}`);
      continue;
    }
    for (const name of chunk.statics.filter((name) => trial.has(name))) {
      leaks.push(`${chunk.name}: imports the trial's ${name} statically`);
    }
    for (const name of chunk.dynamics.filter((name) => trial.has(name))) {
      if (!holdsLoader) leaks.push(`${chunk.name}: fetches the trial's ${name} and is not its loader`);
    }
  }
  return leaks;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dist = process.argv[2];
  if (!dist) {
    console.error("Usage: node scripts/check-map-client-isolation.mjs <dist>");
    process.exit(2);
  }
  const leaks = trialLeaks(dist);
  for (const line of leaks) console.error(line);
  console.log(
    leaks.length === 0
      ? "The map client under trial sits in chunks of its own, fetched only by its loader."
      : "A page that does not ask for the map client under trial would load it.",
  );
  process.exit(leaks.length === 0 ? 0 : 1);
}
