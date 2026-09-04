// @vitest-environment node
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("procedural horse appearance gym UI", () => {
  it("selects the mount appearance and exposes the resolved rig", () => {
    const controls = readFileSync(new URL("./procedural-character-gym-controls.tsx", import.meta.url), "utf8");
    const view = readFileSync(new URL("./procedural-character-gym-view.tsx", import.meta.url), "utf8");

    expect(controls).toContain("PROCEDURAL_HORSE_APPEARANCES.map");
    expect(controls).toContain('label={config.kind === "paladin" ? "Mount appearance" : "Horse appearance"}');
    expect(controls).toContain("onPatchConfig({ horse: { appearanceId:");
    expect(view).toContain("`Rig ${stats.rigAdapterId}`");
  });
});
