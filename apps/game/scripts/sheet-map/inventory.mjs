import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const app = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const sources = [
  "three/managers/worldmap-interaction-palette.ts",
  "three/managers/worldmap-highlight-view-policy.ts",
  "three/managers/hex-ring.ts",
  "three/managers/hover-hex-manager.ts",
  "three/managers/ownership-ring-layer.ts",
  "three/managers/highlight-hex-manager.ts",
  "three/managers/path-renderer.ts",
  "three/scenes/path-readability-policy.ts",
  "three/scenes/worldmap-order-tip.tsx",
  "three/systems/player-colors.ts",
  "three/managers/strategic-marker-layer.ts",
  "three/managers/aura.ts",
  "three/shaders/border-hex-material.ts",
  "three/utils/hex-geometry-pool.ts",
  "three/terrain/terrain-fog-field.ts",
  "three/terrain/terrain-fog-style.ts",
  "three/managers/biome-colors.ts",
  "three/map-plates/map-plates.css",
  "ui/design-system/hex-marker.tsx",
  "ui/features/world/components/bottom-right-panel/hex-minimap.tsx",
];
const entries = sources.map((file) => {
  const source = readFileSync(resolve(app, "src", file), "utf8");
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  const colours = [
    ...new Set(
      [...code.matchAll(/#[0-9a-f]{6}\b|0x[0-9a-f]{6}\b/gi)].map(([literal]) =>
        literal.replace(/^0x/, "#").toLowerCase(),
      ),
    ),
  ].sort();
  return {
    file,
    sha256: createHash("sha256").update(source).digest("hex"),
    literalColourCount: colours.length,
    colours,
  };
});
const report = {
  basis:
    "Hex colour literals (#rrggbb/0xrrggbb), comments excluded; RGB/RGBA formulas, aliases and texture pixels are described in the human inventory. See inventory.md for runtime counts and widths/opacity/motion.",
  sourceCount: entries.length,
  entries,
};
const json = JSON.stringify(report, null, 2) + "\n";
if (process.argv[2]) writeFileSync(resolve(process.argv[2]), json, { flag: "wx" });
else process.stdout.write(json);
