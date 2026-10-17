import { describe, expect, it } from "vitest";
import { BiomeType } from "@bibliothecadao/types";
import { ENDGAME_SEQUENCE, endgameFrame, readEndgameSettings } from "./sequence";
import { createEndgameFixture } from "./fixture";

describe("Fractured veil", () => {
  const settings = readEndgameSettings("");
  it("stays idle until end, materialises, contracts, bursts, spreads and freezes once", () => {
    expect(endgameFrame(settings, null)).toMatchObject({
      phase: "live",
      materialisation: 0,
      spread: 0,
      finished: false,
    });
    expect(endgameFrame(settings, 0.4)).toMatchObject({
      phase: "materialising",
      materialisation: 0.5,
      spread: 0,
      orbScale: 1,
    });
    expect(endgameFrame(settings, 1.5)).toMatchObject({
      phase: "contracting",
      materialisation: 1,
      contraction: 0.5,
      spread: 0,
    });
    expect(endgameFrame(settings, 1.999).orbScale).toBeCloseTo(0.06, 2);
    expect(endgameFrame(settings, 2.1)).toMatchObject({ phase: "bursting", finished: false });
    expect(endgameFrame(settings, 4.75)).toMatchObject({ phase: "spreading", spread: 0.5 });
    expect(endgameFrame(settings, 9)).toMatchObject({
      phase: "frozen",
      seconds: 9,
      spread: 1,
      settle: 1,
      finished: true,
    });
    expect(endgameFrame(settings, 999)).toEqual(endgameFrame(settings, ENDGAME_SEQUENCE.duration));
  });
  it("uses one sequence with only the spared hex changing by world", () => {
    const blitz = readEndgameSettings("?spires=awaken&busy=1");
    const frontier = readEndgameSettings("?spires=awaken&busy=1&gameMode=frontier");
    expect(frontier).toEqual({ ...blitz, spared: "realm" });
    expect(createEndgameFixture(frontier)).toEqual(createEndgameFixture(blitz));
  });
  it.each([false, true])(
    "preserves the biome and surface at both spire sites for either entrance (busy=%s)",
    (busy) => {
      const appeared = createEndgameFixture({ ...settings, busy });
      const discovered = createEndgameFixture({ ...settings, busy, spires: "awaken" });
      expect(appeared.request).toEqual(discovered.request);
      expect(appeared.request.cells).toHaveLength(busy ? 1008 : 320);
      const spireCells = appeared.spires.map(
        (p) => appeared.request.cells.find((c) => c.col === p.col && c.row === p.row)!,
      );
      expect(spireCells.every((c) => c.explored && c.biome !== null && c.surfacePresentation === undefined)).toBe(true);
      if (!busy)
        expect(spireCells.map((c) => c.biome)).toEqual([BiomeType.TemperateDesert, BiomeType.TropicalSeasonalForest]);
      const sites = [...appeared.realms, ...appeared.spires];
      expect(new Set(sites.map((p) => `${p.col}:${p.row}`)).size).toBe(sites.length);
    },
  );
  it("keeps the shipped control on its existing two-second frost", () => {
    const shipped = readEndgameSettings("?shipped=1");
    expect(endgameFrame(shipped, null)).toMatchObject({ phase: "live", spread: 0, finished: false });
    expect(endgameFrame(shipped, 1)).toMatchObject({ phase: "spreading", spread: 0, settle: 0.5, finished: false });
    expect(endgameFrame(shipped, 2)).toMatchObject({ phase: "frozen", spread: 0, settle: 1, finished: true });
  });
});
