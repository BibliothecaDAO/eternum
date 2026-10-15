import { afterEach, describe, expect, it, vi } from "vitest";

import { gameAddresses, judgeStep, linesBetween, proveGame, spiralPoints } from "./prove-play-game.mjs";
import { parseArgs } from "./prove-play.mjs";

/** Game 7's crate as the proof read it: the closed panel's count, the opened panel and the log after a reload. */
const GAME_7_CRATE = {
  step: "crate",
  panel: { contents: ["Relics", "3", "Victory points", "250"] },
  opened: ["Damage Relic II", "Stamina Relic I", "Stamina Relic I"],
  log: ["Relic crate opened", "Stolsli T1 army · Damage Relic II, Stamina Relic I, Stamina Relic I"],
  pageErrors: { errors: "", console: [] },
};

const crateWith = (change) => judgeStep({ ...GAME_7_CRATE, ...change });

/** A browser on an ended game: every entrance shows the ended plate and its Results leads to the game's Results. */
const endedGameBrowser = (pageErrorsByAddress = {}) => {
  let page = "";
  return {
    run: (command, ...args) => {
      if (command === "open") page = new URL(args[0]).pathname;
      if (command === "get") return "https://proof.test/results/0xa-7";
      if ((command === "errors" || command === "console") && args[0] !== "--clear")
        return pageErrorsByAddress[page]?.[command] ?? "";
      return "";
    },
    evaluate: (js) => {
      if (js.startsWith("Boolean(")) return true;
      if (js === "document.body.innerText") return "This game has ended.\nResults";
      return '[data-proof-step="Results"]';
    },
  };
};

const proveEndedGame = async (browser) => {
  vi.useFakeTimers();
  const proof = proveGame(browser, { baseUrl: "https://proof.test", game: "0xa:7", ended: true }, "/proof");
  await vi.runAllTimersAsync();
  return (await proof).records;
};

afterEach(() => vi.useRealTimers());

describe("a game's proof", () => {
  it("holds each step to the game's own addresses", () => {
    expect(gameAddresses("0xa:7")).toEqual({ doorway: "/g/0xa/7", map: "/g/0xa/7/map", results: "/results/0xa-7" });
    expect(() => gameAddresses("0xa")).toThrow("--game expects <chain>:<game>");
  });

  it("needs a signed-in profile for a game", () => {
    expect(() => parseArgs(["--game", "0xa:7"])).toThrow("--game needs --profile");
    expect(
      parseArgs(["--game", "0xa:7", "--profile", "/p", "--crate", "3,11", "--until-end", "40", "--ended"]),
    ).toMatchObject({
      game: "0xa:7",
      profile: "/p",
      crate: [3, 11],
      untilEndMinutes: 40,
      ended: true,
    });
  });

  it("reads an opened crate's relics off its panel", () => {
    const panel = "Crate opened\nContents\nDamage Relic II\nStamina Relic I\nStamina Relic I\nBiome\nBare";
    expect(linesBetween(panel, "Contents", "Biome")).toEqual(GAME_7_CRATE.opened);
    expect(linesBetween("Crate opened\nBiome\nBare", "Contents", "Biome")).toEqual([]);
  });

  it("passes a crate whose log names exactly the relics its panel listed", () => {
    expect(judgeStep(GAME_7_CRATE).problem).toBeUndefined();
  });

  it("fails a crate whose log names another tier of a relic", () => {
    expect(crateWith({ opened: ["Damage Relic I", "Stamina Relic I", "Stamina Relic I"] }).problem).toBe(
      "the log names other relics than the panel",
    );
  });

  it("fails a crate whose log drops a duplicate relic", () => {
    const log = ["Relic crate opened", "Stolsli T1 army · Damage Relic II, Stamina Relic I"];
    expect(crateWith({ log }).problem).toBe("the log names other relics than the panel");
  });

  it("fails a crate whose opened panel lists no contents", () => {
    expect(crateWith({ opened: [] }).problem).toBe("the panel advertised 3 relics and listed 0");
    expect(crateWith({ panel: { contents: [] } }).problem).toBe("the closed crate's panel advertised no relic count");
  });

  it("fails a crate the log does not hold after the reload", () => {
    expect(crateWith({ log: [] }).problem).toBe("the log holds no crate opening after the reload");
  });

  it("completes an ended game whose entrances reach its Results without errors", async () => {
    const records = await proveEndedGame(endedGameBrowser());
    expect(records.map((record) => [record.step, record.layout, record.led, record.problem])).toEqual([
      ["ended-doorway", "desktop", "/results/0xa-7", undefined],
      ["ended-map", "desktop", "/results/0xa-7", undefined],
      ["ended-doorway", "phone", "/results/0xa-7", undefined],
      ["ended-map", "phone", "/results/0xa-7", undefined],
    ]);
  });

  it("fails the step whose page raised an error, keeping the error as the browser gave it", async () => {
    const records = await proveEndedGame(
      endedGameBrowser({
        "/g/0xa/7/map": { console: "[warning] GameRenderer: slow\n[error] [bootstrap] game entry bootstrap failed" },
        "/g/0xa/7": { errors: "TypeError: x is undefined" },
      }),
    );
    expect(records.map((record) => record.problem)).toEqual(Array(4).fill("the page raised errors"));
    expect(records[0].pageErrors).toEqual({ errors: "TypeError: x is undefined", console: [] });
    expect(records[1].pageErrors.console).toEqual([
      "[warning] GameRenderer: slow",
      "[error] [bootstrap] game entry bootstrap failed",
    ]);
  });

  it("passes a step whose console holds only warnings", async () => {
    const records = await proveEndedGame(
      endedGameBrowser({ "/g/0xa/7/map": { console: "[warning] GameRenderer: slow" } }),
    );
    expect(records.every((record) => !record.problem)).toBe(true);
    expect(records[1].pageErrors.console).toEqual(["[warning] GameRenderer: slow"]);
  });

  it("moves the pointer outward from the tile the map opens on", () => {
    const points = spiralPoints([720, 450], { radius: 40, step: 40 });
    expect(points[0]).toEqual([720, 450]);
    expect(points).toHaveLength(9);
  });
});
