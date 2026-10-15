import { afterEach, describe, expect, it, vi } from "vitest";

import { gameAddresses, judgeStep, linesBetween, proveGame, spiralPoints } from "./prove-play-game.mjs";
import { parseArgs } from "./prove-play.mjs";

/** Game 7's crate as the proof read it: the closed panel's count, the opened panel and the log after a reload. */
const GAME_7_CRATE = {
  step: "crate",
  panel: { contents: ["Relics", "3", "Victory points", "250"] },
  opened: ["Damage Relic II", "Stamina Relic I", "Stamina Relic I"],
  log: ["Relic crate opened", "Stolsli T1 army · Damage Relic II, Stamina Relic I, Stamina Relic I"],
  pageErrors: { errors: [], console: [] },
};

const crateWith = (change) => judgeStep({ ...GAME_7_CRATE, ...change });

/**
 * A browser on an ended game: every entrance shows the ended plate and its Results leads to the game's Results. Each
 * open of an address raises the next of its listed errors while the page loads, before `open` returns. The session
 * keeps them across navigations, as agent-browser does, until a `--clear`, which this browser honours.
 */
const endedGameBrowser = (raisedOnOpen = {}) => {
  const session = { errors: [], console: [] };
  const answer = (data) => JSON.stringify({ success: true, data, error: null });
  return {
    run: (command, ...args) => {
      if (command === "open") {
        const raised = raisedOnOpen[new URL(args[0]).pathname]?.shift() ?? {};
        session.errors.push(...(raised.errors ?? []).map((text) => ({ text, line: 0, column: 0, url: null })));
        session.console.push(...(raised.console ?? []));
      }
      if (command === "get") return "https://proof.test/results/0xa-7";
      if ((command === "errors" || command === "console") && args[0] === "--clear") session[command] = [];
      if (command === "errors") return answer({ errors: session.errors });
      if (command === "console") return answer({ messages: session.console });
      return "";
    },
    evaluate: (js) => {
      if (js.startsWith("Boolean(")) return true;
      if (js === "document.body.innerText") return "This game has ended.\nResults";
      return '[data-proof-step="Results"]';
    },
  };
};

const STARTUP_ERROR = { errors: ["TypeError: startup listener failed"] };
const STARTUP_CONSOLE = {
  console: [
    { type: "warning", text: "GameRenderer: slow" },
    { type: "error", text: "initial page initialization failed" },
  ],
};
const WARNING_ONLY = { console: [{ type: "warning", text: "GameRenderer: slow" }] };

const proveEndedGame = async (browser) => {
  vi.useFakeTimers();
  const proof = proveGame(browser, { baseUrl: "https://proof.test", game: "0xa:7", ended: true }, "/proof");
  await vi.runAllTimersAsync();
  return (await proof).records;
};

afterEach(() => vi.useRealTimers());

describe("a game's proof", () => {
  it("holds each step to the game's own addresses", () => {
    expect(gameAddresses("0xa:7")).toEqual({
      doorway: "/g/0xa/7",
      map: "/g/0xa/7/map",
      realm: "/g/0xa/7/hex",
      results: "/results/0xa-7",
    });
    expect(() => gameAddresses("0xa")).toThrow("--game expects <chain>:<game>");
  });

  it("needs a signed-in profile for a game", () => {
    expect(() => parseArgs(["--game", "0xa:7"])).toThrow("--game needs --profile");
    expect(
      parseArgs(["--game", "0xa:7", "--profile", "/p", "--at-rest", "--crate", "3,11", "--until-end", "40", "--ended"]),
    ).toMatchObject({
      game: "0xa:7",
      profile: "/p",
      crate: [3, 11],
      untilEndMinutes: 40,
      ended: true,
      atRest: true,
    });
  });

  it("takes a game's tasks by name and refuses one it does not know", () => {
    expect(parseArgs(["--game", "0xa:7", "--profile", "/p", "--tasks", "production,standings"]).tasks).toEqual([
      "production",
      "standings",
    ]);
    expect(() => parseArgs(["--game", "0xa:7", "--profile", "/p", "--tasks", "production,fly"])).toThrow(
      "Unknown task fly",
    );
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

  it("fails every step whose page raised errors while it opened, keeping each step's own", async () => {
    const records = await proveEndedGame(
      endedGameBrowser({
        "/g/0xa/7": [STARTUP_ERROR, STARTUP_ERROR],
        "/g/0xa/7/map": [STARTUP_CONSOLE, STARTUP_CONSOLE],
      }),
    );
    expect(records.map((record) => record.problem)).toEqual(Array(4).fill("the page raised errors"));
    const doorway = { errors: ["TypeError: startup listener failed"], console: [] };
    const map = { errors: [], console: ["[warning] GameRenderer: slow", "[error] initial page initialization failed"] };
    expect(records.map((record) => record.pageErrors)).toEqual([doorway, map, doorway, map]);
  });

  it("charges an error to the step that raised it, not to the steps after it", async () => {
    const records = await proveEndedGame(endedGameBrowser({ "/g/0xa/7": [STARTUP_ERROR] }));
    expect(records.map((record) => record.problem ?? "pass")).toEqual([
      "the page raised errors",
      "pass",
      "pass",
      "pass",
    ]);
    expect(records.slice(1).map((record) => record.pageErrors)).toEqual(Array(3).fill({ errors: [], console: [] }));
  });

  it("passes a step whose console holds only warnings, keeping them", async () => {
    const records = await proveEndedGame(endedGameBrowser({ "/g/0xa/7/map": [WARNING_ONLY, WARNING_ONLY] }));
    expect(records.every((record) => !record.problem)).toBe(true);
    expect(records[1].pageErrors.console).toEqual(["[warning] GameRenderer: slow"]);
    expect(records[3].pageErrors.console).toEqual(["[warning] GameRenderer: slow"]);
  });

  it("moves the pointer outward from the tile the map opens on", () => {
    const points = spiralPoints([720, 450], { radius: 40, step: 40 });
    expect(points[0]).toEqual([720, 450]);
    expect(points).toHaveLength(9);
  });
});
