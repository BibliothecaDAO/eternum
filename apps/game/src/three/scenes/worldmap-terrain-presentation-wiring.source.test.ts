// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

const extractMethod = (source: string, startMarker: string, endMarker: string): string => {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  return source.slice(start, end);
};

describe("worldmap terrain presentation wiring", () => {
  it("allocates biome capacity for the configured visual composite chunk budget", () => {
    const configSource = readSource("src/three/constants/world-chunk-config.ts");
    const worldmapSource = readSource("src/three/scenes/worldmap.tsx");

    expect(configSource).toContain("visualPresentation");
    expect(configSource).toContain("maxCompositeChunks: 3");
    expect(configSource).toContain("rollingWindowEnabled: true");
    expect(configSource).toContain("visualPageSize");
    expect(configSource).toContain("maxCompositePages: 12");
    expect(configSource).toContain("provisionalShellEnabled: true");
    expect(configSource).toContain("previousExactRetainMs: 250");
    expect(worldmapSource).toMatch(
      /this\.renderChunkSize\.width\s*\*\s*this\.renderChunkSize\.height\s*\+\s*WORLDMAP_CHUNK_POLICY\.visualPresentation\.visualPageSize\.width\s*\*\s*WORLDMAP_CHUNK_POLICY\.visualPresentation\.visualPageSize\.height\s*\*\s*WORLDMAP_CHUNK_POLICY\.visualPresentation\.maxCompositePages/,
    );
  });

  it("samples the camera on controls changes for visual terrain without forcing chunk authority refresh", () => {
    const changeHandler = extractMethod(
      readSource("src/three/scenes/worldmap.tsx"),
      "  private handleWorldmapControlsChange",
      "  private isUrlChangedListenerAttached",
    );

    expect(changeHandler).toContain("refreshVisualTerrainWindowThrottled");
    expect(changeHandler.indexOf("refreshVisualTerrainWindowThrottled")).toBeLessThan(
      changeHandler.indexOf("requestChunkRefresh"),
    );
  });

  it("owns authoritative chunk preparation before starting its observer-only terrain shell", () => {
    const performChunkSwitch = extractMethod(
      readSource("src/three/scenes/worldmap.tsx"),
      "  private async performChunkSwitch",
      "  private async refreshCurrentChunk",
    );

    const shellStart = performChunkSwitch.indexOf("startChunkSwitchTerrainShell");
    const preparationOwnerStart = performChunkSwitch.indexOf("exactTerrainPreparations.start");

    expect(shellStart).toBeGreaterThanOrEqual(0);
    expect(preparationOwnerStart).toBeGreaterThanOrEqual(0);
    expect(preparationOwnerStart).toBeLessThan(shellStart);
    expect(performChunkSwitch).toContain("await exactTerrainPreparation.promise");
  });

  it("keeps provisional shells visual-only without advancing chunk authority or managers", () => {
    const shellMethod = extractMethod(
      readSource("src/three/scenes/worldmap.tsx"),
      "  private startChunkSwitchTerrainShell",
      "  private deferNonCriticalManagerCatchUpForChunk",
    );

    expect(shellMethod).toContain("terrain_shell_started");
    expect(shellMethod).toContain("terrain_shell_committed");
    expect(shellMethod).toContain("exactTerrainPreparations.waitForExact");
    expect(shellMethod).toContain("WORLDMAP_EXACT_TERRAIN_JOIN_BUDGET_MS");
    expect(shellMethod.indexOf('exactJoin.status === "exact_ready"')).toBeLessThan(
      shellMethod.indexOf("createPreparedTerrainChunkFromCache"),
    );
    expect(shellMethod.indexOf('exactJoin.status === "exact_ready"')).toBeLessThan(
      shellMethod.indexOf("await this.prepareTerrainChunk"),
    );
    expect(shellMethod).toContain("applyWorldmapVisualTerrainPage");
    expect(shellMethod).not.toContain("commitCurrentChunkAuthority");
    expect(shellMethod).not.toContain("updateManagersForChunk");
    expect(shellMethod).not.toContain("computeInteractiveHexes");
  });

  it("contains shell preparation failures inside the async shell worker", () => {
    const shellWorker = extractMethod(
      readSource("src/three/scenes/worldmap.tsx"),
      "  private async commitChunkSwitchTerrainShell",
      "  private deferNonCriticalManagerCatchUpForChunk",
    );

    expect(shellWorker).toContain("try {");
    expect(shellWorker).toContain("catch (error)");
    expect(shellWorker).toContain("Failed to build chunk switch terrain shell");
  });

  it("releases exact preparation ownership when the worldmap switches off", () => {
    const switchOffInvalidation = extractMethod(
      readSource("src/three/scenes/worldmap.tsx"),
      "  private invalidateWorldmapSwitchOffTransitions",
      "  private clearWorldmapLoadingStateForSwitchOff",
    );

    expect(switchOffInvalidation).toContain("exactTerrainPreparations.clear()");
  });

  it("routes exact terrain commits through visual page replacement", () => {
    const exactCommit = extractMethod(
      readSource("src/three/scenes/worldmap.tsx"),
      "  private applyPreparedTerrainChunk",
      "  private updatePinnedChunks",
    );

    expect(exactCommit).toContain("partitionPreparedTerrainIntoVisualPages");
    expect(exactCommit).toContain("visual_page");
    expect(exactCommit).toContain("visual_page_replaced");
    expect(exactCommit.indexOf("partitionPreparedTerrainIntoVisualPages")).toBeLessThan(
      exactCommit.indexOf("requestVisualTerrainCompositeCommit"),
    );
    expect(exactCommit.indexOf("requestVisualTerrainCompositeCommit")).toBeLessThan(
      exactCommit.indexOf("computeInteractiveHexes"),
    );
  });
});
