import { describe, expect, it } from "vitest";
import { MODEL_LAB_SEQUENCE_SECONDS, sampleModelLabMotion } from "./model-lab-motion";
import { readModelLabSettings, writeModelLabSettings } from "./model-lab-settings";

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
});
