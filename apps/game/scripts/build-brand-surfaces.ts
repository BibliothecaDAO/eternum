// Writes the brand's copies on the surfaces that cannot import the token file (src/brand/surfaces.ts), from the token
// file: run after a brand value changes; src/brand/brand.test.ts fails until it has run. Writing twice changes nothing.
// Run from apps/game: pnpm brand:surfaces
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { BRAND_SURFACES, writeSurface } from "../src/brand/surfaces";

const REPO = fileURLToPath(new URL("../../../", import.meta.url));

for (const surface of BRAND_SURFACES) {
  const file = `${REPO}${surface.path}`;
  const text = existsSync(file) ? readFileSync(file, "utf8") : "";
  const written = writeSurface(surface, text);
  if (written === text) continue;
  writeFileSync(file, written);
  console.log(`wrote ${surface.path}`);
}
