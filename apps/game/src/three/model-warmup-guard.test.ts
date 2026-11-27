import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const THREE_ROOT = path.resolve(import.meta.dirname);

const PURE_ASSET_LOADER_ALLOWLIST = new Set([
  "characters/boat/quaternius-pirate-ship-assets.ts",
  "characters/dragon/icy-dragon-assets.ts",
  "characters/horse/quaternius-horse-assets.ts",
  "characters/melee/procedural-melee-weapon-library.ts",
  "characters/quaternius-character-assets.ts",
  "characters/t1-knight-default-character-assets.ts",
  "cosmetics/asset-cache.ts",
  "cosmetics/skin-asset-source.ts",
  "structures/deep-landmarks.ts",
  "structures/procedural-model-resolver.ts",
  "structures/well-shrine-kit.ts",
  "terrain/creatures/biome-creature-assets.ts",
  "terrain/terrain-prop-asset-cache.ts",
  "terrain/terrain-prop-pools.ts",
  "utils/gltf-loader.ts",
  "utils/utils.ts",
]);

const REQUIRED_WARMUP_OWNERS = [
  "managers/structure-manager.ts",
  "managers/army-model.ts",
  "characters/procedural-army-character-layer.ts",
  "cosmetics/attachment-manager.ts",
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

const MODEL_LOADER_SYMBOL =
  /\b(gltfLoader|loadCosmeticAsset|resolveAllSkinGltfs|resolvePrimarySkinGltf|loadTerrainPropCatalog|loadBiomeCreature|loadDeepLandmark|resolveProceduralWellShrineKit|createWellKit|createShrineKit)\b/;

const HAS_WARMUP_INVOCATION =
  /\b(?:this\.)?compilePipelines(?:\?\.)?\s*\(|\bcreatePipelineCompiler\s*\(|\bwarmIconTexture(?:\?\.)?\s*\(/;

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
  it("refuses any runtime GLB or wrapper-loader consumer that skips PipelineCompiler", () => {
    const runtimeFiles = collectRuntimeThreeFiles(THREE_ROOT);
    const offenders: string[] = [];

    for (const rel of runtimeFiles) {
      if (PURE_ASSET_LOADER_ALLOWLIST.has(rel)) continue;
      const source = readFileSync(path.join(THREE_ROOT, rel), "utf8");
      if (!MODEL_LOADER_SYMBOL.test(source)) continue;
      if (!HAS_WARMUP_INVOCATION.test(source)) offenders.push(rel);
    }

    expect(offenders).toEqual([]);
  });

  it("ensures every runtime model and FX owner invokes the shared PipelineCompiler chokepoint", () => {
    const missing: string[] = [];

    for (const rel of REQUIRED_WARMUP_OWNERS) {
      const source = readFileSync(path.join(THREE_ROOT, rel), "utf8");
      if (!HAS_WARMUP_INVOCATION.test(source)) missing.push(rel);
    }

    expect(missing).toEqual([]);
  });

  it("wires compilePipelines into every owned runtime model, cosmetic, terrain, and FX manager", () => {
    const worldmapSource = readFileSync(path.join(THREE_ROOT, "scenes/worldmap.tsx"), "utf8");
    const armyManagerSource = readFileSync(path.join(THREE_ROOT, "managers/army-manager.ts"), "utf8");
    const structureManagerSource = readFileSync(path.join(THREE_ROOT, "managers/structure-manager.ts"), "utf8");
    const requiredWorldmapWiring = [
      /new FXManager\([^;]*compilePipelines:\s*this\.compilePipelines/,
      /new ResourceFXManager\([^;]*compilePipelines:\s*this\.compilePipelines/,
      /new WorldmapProceduralTerrain\([^;]*compilePipelines:\s*this\.compilePipelines/,
      /new MapSiteManager\([^;]*this\.compilePipelines/,
      /new DeepArenaManager\([^;]*this\.compilePipelines/,
      /new SpireManager\([^;]*this\.compilePipelines/,
      /new StructureManager\([^;]*this\.compilePipelines/,
      /new ArmyManager\([^;]*this\.compilePipelines/,
    ];

    for (const pattern of requiredWorldmapWiring) {
      expect(worldmapSource).toMatch(pattern);
    }
    expect(armyManagerSource).toMatch(/new CosmeticAttachmentManager\(scene,\s*compilePipelines\)/);
    expect(structureManagerSource).toMatch(/new CosmeticAttachmentManager\(scene,\s*compilePipelines\)/);
  });
});
