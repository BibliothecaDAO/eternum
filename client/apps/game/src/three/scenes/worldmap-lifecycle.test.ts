import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const worldmapSource = readFileSync(path.resolve(__dirname, "worldmap.tsx"), "utf8");

describe("Worldmap lifecycle baseline", () => {
  it("registers urlChanged with a stable handler identity and removes it during teardown", () => {
    const definesUrlChangedHandler = /private\s+(readonly\s+)?urlChangedHandler/.test(worldmapSource);
    const addsUrlChangedHandler = /window\.addEventListener\("urlChanged",\s*this\.urlChangedHandler\)/.test(
      worldmapSource,
    );
    const removesUrlChangedHandler = /window\.removeEventListener\("urlChanged",\s*this\.urlChangedHandler\)/.test(
      worldmapSource,
    );

    expect(definesUrlChangedHandler).toBe(true);
    expect(addsUrlChangedHandler).toBe(true);
    expect(removesUrlChangedHandler).toBe(true);
  });

  it("short-circuits updateVisibleChunks when the worldmap scene is switched off", () => {
    const hasUpdateVisibleChunks = /async\s+updateVisibleChunks\s*\(/.test(worldmapSource);
    const hasSwitchedOffGuard = /if\s*\(this\.isSwitchedOff\)\s*\{\s*return\s+false;\s*\}/s.test(worldmapSource);
    expect(hasUpdateVisibleChunks).toBe(true);
    expect(hasSwitchedOffGuard).toBe(true);
  });

  it("reuses onSwitchOff cleanup from destroy to keep teardown behavior symmetrical", () => {
    const destroyCallsOnSwitchOff = /destroy\(\)\s*\{\s*this\.onSwitchOff\(\);/s.test(worldmapSource);
    expect(destroyCallsOnSwitchOff).toBe(true);
  });
});
