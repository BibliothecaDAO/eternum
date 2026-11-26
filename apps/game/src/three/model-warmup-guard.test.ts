import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const THREE_ROOT = path.resolve(import.meta.dirname);

const PURE_GLTF_LOADER_ALLOWLIST = new Set([
  "characters/boat/quaternius-pirate-ship-assets.ts",
  "characters/dragon/icy-dragon-assets.ts",
  "characters/horse/quaternius-horse-assets.ts",
  "characters/melee/procedural-melee-weapon-library.ts",
  "characters/quaternius-character-assets.ts",
  "characters/t1-knight-default-character-assets.ts",
  "cosmetics/asset-cache.ts",
  "cosmetics/skin-asset-source.ts",
  "structures/deep-landmarks.ts",
  "terrain/creatures/biome-creature-assets.ts",
  "terrain/terrain-prop-asset-cache.ts",
  "utils/gltf-loader.ts",
  "utils/utils.ts",
]);

const REQUIRED_WARMUP_OWNERS = [
  "managers/structure-manager.ts",
  "managers/army-model.ts",
  "characters/procedural-army-character-layer.ts",
  "managers/map-site-manager.ts",
  "managers/spire-manager.ts",
  "managers/deep-arena-manager.ts",
  "terrain/procedural-terrain.ts",
  "terrain/terrain-wildlife.ts",
  "managers/fx-manager.ts",
  "managers/resource-fx-manager.ts",
  "managers/building-preview.ts",
  "scenes/hexception.tsx",
  "race/aspect-race-renderer.ts",
];

function collectRuntimeThreeFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const rel = path.relative(THREE_ROOT, full).replace(/\\/g, "/");
    if (statSync(full).isDirectory()) {
      if (entry === "debug" || entry === "benchmark" || entry === "verification") continue;
      collectRuntimeThreeFiles(full, out);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry)) continue;
    if (/\.test\.(ts|tsx)$/.test(entry)) continue;
    out.push(rel);
  }
  return out;
}

describe("model warm-up chokepoint guard", () => {
  it("refuses any runtime GLB loader under apps/game/src/three/ that bypasses PipelineCompiler", () => {
    const runtimeFiles = collectRuntimeThreeFiles(THREE_ROOT);
    const offenders: string[] = [];

    for (const rel of runtimeFiles) {
      if (PURE_GLTF_LOADER_ALLOWLIST.has(rel)) continue;
      const source = readFileSync(path.join(THREE_ROOT, rel), "utf8");
      if (!/\bgltfLoader\b/.test(source)) continue;
      const usesWarmup = /\b(compilePipelines|createPipelineCompiler|warmTexturePipeline)\b/.test(source);
      if (!usesWarmup) offenders.push(rel);
    }

    expect(offenders).toEqual([]);
  });

  it("ensures every runtime model and FX owner routes through the shared PipelineCompiler chokepoint", () => {
    const missing: string[] = [];

    for (const rel of REQUIRED_WARMUP_OWNERS) {
      const source = readFileSync(path.join(THREE_ROOT, rel), "utf8");
      const usesWarmup = /\b(compilePipelines|createPipelineCompiler|warmTexturePipeline)\b/.test(source);
      if (!usesWarmup) missing.push(rel);
    }

    expect(missing).toEqual([]);
  });

  it("wires WorldmapScene compilePipelines into every owned runtime model, terrain, and FX manager", () => {
    const worldmapSource = readFileSync(path.join(THREE_ROOT, "scenes/worldmap.tsx"), "utf8");
    const requiredWiring = [
      /new FXManager\([^)]*compilePipelines:\s*this\.compilePipelines/,
      /new ResourceFXManager\([^)]*compilePipelines:\s*this\.compilePipelines/,
      /new WorldmapProceduralTerrain\([^)]*compilePipelines:\s*this\.compilePipelines/,
      /new MapSiteManager\([\s\S]*?this\.compilePipelines\s*,?\s*\)/,
      /new DeepArenaManager\([\s\S]*?this\.compilePipelines\s*,?\s*\)/,
      /new SpireManager\([\s\S]*?this\.compilePipelines/,
      /new StructureManager\([\s\S]*?this\.compilePipelines/,
      /new ArmyManager\([\s\S]*?this\.compilePipelines/,
    ];

    for (const pattern of requiredWiring) {
      expect(worldmapSource).toMatch(pattern);
    }
  });
});
