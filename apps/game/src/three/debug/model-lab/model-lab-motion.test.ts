import { describe, expect, it, vi } from "vitest";
import { MODEL_LAB_SEQUENCE_SECONDS, sampleModelLabMotion } from "./model-lab-motion";
import {
  listModelLabActions,
  listModelLabBiomeIds,
  readModelLabSettings,
  writeModelLabSettings,
} from "./model-lab-settings";

describe("model lab review choreography", () => {
  it("sails across the review course and anchors in place", () => {
    expect(sampleModelLabMotion("move", 0).shipZ).toBe(0.5);
    expect(sampleModelLabMotion("move", MODEL_LAB_SEQUENCE_SECONDS).shipZ).toBe(-3);
    expect(sampleModelLabMotion("idle", 3)).toMatchObject({ shipZ: 0.5, sailing: false });
  });
  it("shares class, source, tier, camera and animation settings exactly", () => {
    const settings = readModelLabSettings(
      new URLSearchParams(
        "family=ships&army=paladin&source=study&tier=3&compare=0&action=move&sailColor=%23802040&sailPrint=crown&wind=1.7&camera=rts&speed=0.5&wireframe=1&biome=tropical&lighting=sunset",
      ),
    );
    expect(readModelLabSettings(writeModelLabSettings(settings))).toEqual(settings);
  });
  it("normalizes unsupported combinations and malformed speeds", () => {
    expect(
      readModelLabSettings(new URLSearchParams("family=knight&source=study&action=board&speed=NaN")),
    ).toMatchObject({ source: "current", action: "idle", speed: 1 });
  });
  it("keeps the public lab to its original five biomes, idle and move, and no T1 Knight Default", () => {
    expect(listModelLabBiomeIds()).toEqual(["grassland", "forest", "desert", "snow", "tropical"]);
    expect(listModelLabActions("knight")).toEqual(["idle", "move"]);
    expect(
      readModelLabSettings(new URLSearchParams("family=knight&source=t1-knight-default&action=run&biome=taiga")),
    ).toMatchObject({ source: "current", action: "idle", biome: "grassland" });
  });
  it("brings the T1 Knight Default, Run and every land biome under the review flag", () => {
    vi.stubGlobal("window", { location: { search: "?t1KnightDefault=1" } });
    try {
      expect(listModelLabBiomeIds()).toHaveLength(14);
      expect(listModelLabActions("ships")).toEqual(["idle", "move"]);
      expect(
        readModelLabSettings(new URLSearchParams("family=knight&source=t1-knight-default&action=run&biome=taiga")),
      ).toMatchObject({ source: "t1-knight-default", action: "run", biome: "taiga" });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
