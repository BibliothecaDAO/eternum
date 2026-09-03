import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const read = (relativePath: string) => readFileSync(join(currentDir, relativePath), "utf8");

/**
 * The zoom band is the single content gate: every surface that the far band
 * must drop reads `resolveWorldmapContentLadder` instead of deciding on its own.
 */
describe("worldmap content ladder wiring", () => {
  it("applies the ladder from the scene's band listener to terrain, FX, ghosts and label priority", () => {
    const source = read("worldmap.tsx");
    expect(source).toMatch(
      /runWithFrameWorkOwner\("zoom:content-ladder", \(\) => \{\s*this\.applyContentLadder\(resolveWorldmapContentLadder\(view\)\)/,
    );
    expect(source).toMatch(/this\.worldBiomeSurface\.setVisible\(ladder\.biomeUnderlay\)/);
    expect(source).toMatch(/this\.proceduralTerrain\.object3d\.visible = ladder\.band !== CameraView\.Far/);
    expect(source).toMatch(/this\.fxManager\.setVisible\(ladder\.fx\)/);
    expect(source).toMatch(/this\.resourceFXManager\.setVisible\(ladder\.fx\)/);
    expect(source).toMatch(/this\.combatPresentation\?\.setVisible\(ladder\.fx\)/);
    expect(source).toMatch(/this\.arrivalGhostManager\.setSuspended\(!ladder\.fx\)/);
    expect(source).toMatch(/this\.armyManager\.setLabelPriorityContext\(context\)/);
    expect(source).toMatch(/this\.structureManager\.setLabelPriorityContext\(context\)/);
  });

  it("keeps the far band's subjects on the strategic marker layer fed from the whole-world projection", () => {
    const source = read("worldmap.tsx");
    expect(source).toMatch(/this\.strategicMarkers\.setVisible\(ladder\.band === CameraView\.Far\)/);
    expect(source).toMatch(/this\.seedWorldBiomeSurface\(\);\s*this\.seedStrategicMarkers\(\);/);
    expect(source).toMatch(
      /this\.worldSpatialProjection\.getStructures\(\)\.forEach\(\(structure\) => this\.writeStructureMarker\(structure\)\)/,
    );
    expect(source).toMatch(/this\.syncStructureMarkers\(changes\)/);
    expect(source).toMatch(/this\.syncArmyMarkers\(changes\)/);
    expect(source).toMatch(/this\.strategicMarkers\.setViewPitch\(pitch\)/);
  });

  it("uses the minimap's biome classification and color source for the far-band ground", () => {
    const worldmap = read("worldmap.tsx");
    const surface = read("../terrain/world-biome-surface.ts");
    const minimap = read("../../ui/features/world/components/bottom-right-panel/hex-minimap.tsx");

    expect(worldmap).toContain("requireBiomeTypeFromId(tile.biome)");
    expect(minimap).toContain("resolveBiomeTypeFromId(biomeId)");
    expect(surface).toContain("requireBiomeColor(biome)");
    expect(worldmap).not.toContain("BiomeIdToType");
    expect(minimap).not.toContain("BiomeIdToType");
  });

  it("keeps biome-colors.ts the only source file resolving biome ids", () => {
    const srcRoot = join(currentDir, "../..");
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        if (entry === "node_modules" || entry === "dist" || entry === "assets") continue;
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) {
          walk(path);
          continue;
        }
        if (!/\.tsx?$/.test(entry) || /\.test\.tsx?$/.test(entry)) continue;
        if (readFileSync(path, "utf8").includes("BiomeIdToType")) offenders.push(relative(srcRoot, path));
      }
    };
    walk(srcRoot);
    expect(offenders, "resolve biome ids through three/managers/biome-colors.ts, never locally").toEqual([
      "three/managers/biome-colors.ts",
    ]);
  });

  it("refreshes label priority on hover, hex leave and selection changes", () => {
    const source = read("worldmap.tsx");
    expect(source.match(/this\.refreshLabelPriorityContext\(\)/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
    expect(source).toMatch(/isSpectator: isExplicitSpectateSession\(\)/);
  });

  it("owns one namespaced compact-label renderer for both entity managers", () => {
    const source = read("worldmap.tsx");
    expect(source.match(/new CompactEntityLabelRenderer\(this\.scene\)/g)).toHaveLength(1);
    expect(source).toContain('this.compactEntityLabelRenderer.createScope("army")');
    expect(source).toContain('this.compactEntityLabelRenderer.createScope("structure")');
    expect(source).toContain("this.compactEntityLabelRenderer.updateCamera(this.camera)");
    expect(source).toContain("this.compactEntityLabelRenderer.dispose()");
  });

  it("retires duplicate army and structure point-label layers", () => {
    const army = read("../managers/army-manager.ts");
    const structure = read("../managers/structure-manager.ts");

    expect(army).not.toContain("PointsLabelRenderer");
    expect(army).not.toContain("pointsRenderers");
    expect(army).not.toContain("/images/labels/");
    expect(structure).not.toContain("PointsLabelRenderer");
    expect(structure).not.toContain("pointsRenderers");
    expect(structure).not.toContain("/images/labels/");
  });

  it("gates army models, procedural characters and compact labels from the same table", () => {
    const source = read("../managers/army-manager.ts");
    expect(source).toMatch(/this\.applyContentLadder\(resolveWorldmapContentLadder\(view\)\)/);
    expect(source).toMatch(/this\.armyModel\.setModelsVisible\(ladder\.armyModels\)/);
    expect(source).toMatch(/if \(this\.contentLadder\.proceduralCharacters\) \{/);
    expect(source).toMatch(
      /if \(!this\.shouldShowArmyCompactLabel\(army\)\) \{\s*this\.compactLabelRenderer\.removeLabel\(army\.entityId\)/,
    );
    expect(source).toMatch(/this\.contentLadder\.armyTierGlyphs \? army\.tier : resolveArmyCompactEntityLabel\(army\)/);
  });

  it("hides chest models and labels through the ladder and parents every FX under one root", () => {
    expect(read("../managers/chest-manager.ts")).toMatch(/this\.chestModel\.group\.visible = ladder\.structureModels/);
    const backends = read("../fx/world-fx-backends.ts");
    expect(backends).toMatch(/protected readonly root = new THREE\.Group\(\)/);
    expect(backends).not.toMatch(/this\.scene\.add\(this\.group\)/);
    expect(backends).not.toMatch(/scene\.add\(this\.group\)/);
  });
});
