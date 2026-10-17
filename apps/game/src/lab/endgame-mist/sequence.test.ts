import { describe, expect, it } from "vitest";
import { ENDGAME_VARIATIONS, endgameFrame, readEndgameSettings } from "./sequence";
import { createEndgameFixture } from "./fixture";

describe("endgame lab sequence", () => {
  it.each(["surge", "tide", "fracture"] as const)(
    "keeps %s idle before end, runs once and skips to the same frozen state",
    (variation) => {
      const settings = { variation, spires: "awaken" as const, spared: "none" as const, busy: false };
      const choice = ENDGAME_VARIATIONS[variation];
      expect(endgameFrame(settings, null)).toEqual({
        phase: "live",
        seconds: 0,
        emergence: 0,
        spread: 0,
        settle: 0,
        finished: false,
      });
      expect(endgameFrame(settings, choice.awaken / 2)).toMatchObject({
        phase: "awakening",
        emergence: 0.5,
        spread: 0,
      });
      const middle = choice.awaken + (choice.duration - choice.awaken - choice.settle) / 2;
      expect(endgameFrame(settings, middle)).toMatchObject({ phase: "spreading", spread: 0.5, finished: false });
      expect(endgameFrame(settings, choice.duration)).toEqual({
        phase: "frozen",
        seconds: choice.duration,
        emergence: 1,
        spread: 1,
        settle: 1,
        finished: true,
      });
      expect(endgameFrame(settings, 999)).toEqual(endgameFrame(settings, choice.duration));
    },
  );
  it("changes only spared hexes between Blitz and Frontier fixtures", () => {
    const blitz = readEndgameSettings("?variation=tide&spires=rise&busy=1");
    const frontier = readEndgameSettings("?variation=tide&spires=rise&busy=1&gameMode=frontier");
    expect(frontier).toEqual({ ...blitz, spared: "realm" });
    expect(createEndgameFixture(frontier)).toEqual(createEndgameFixture(blitz));
    const fixture = createEndgameFixture(blitz);
    expect(fixture.request.cells).toHaveLength(1008);
    expect(fixture.realms).toHaveLength(25);
    expect(fixture.request.cells.filter((c) => !c.explored).map(({ col, row }) => ({ col, row }))).toEqual(
      fixture.spires,
    );
  });
});

it("keeps the shipped control on its existing two-second frost without spire awakening", () => {
  const settings = readEndgameSettings("?shipped=1");
  expect(endgameFrame(settings, null)).toEqual({
    phase: "live",
    seconds: 0,
    emergence: 0,
    spread: 0,
    settle: 0,
    finished: false,
  });
  expect(endgameFrame(settings, 1)).toEqual({
    phase: "spreading",
    seconds: 1,
    emergence: 0,
    spread: 0,
    settle: 0.5,
    finished: false,
  });
  expect(endgameFrame(settings, 2)).toEqual({
    phase: "frozen",
    seconds: 2,
    emergence: 0,
    spread: 0,
    settle: 1,
    finished: true,
  });
});

it.each([false, true])("keeps every realm and spire on a distinct fixture hex (busy=%s)", (busy) => {
  for (const spires of ["awaken", "rise"] as const) {
    const fixture = createEndgameFixture({ variation: "surge", spared: "none", spires, busy });
    const sites = [...fixture.realms, ...fixture.spires];
    expect(new Set(sites.map((p) => `${p.col}:${p.row}`)).size).toBe(sites.length);
  }
});
