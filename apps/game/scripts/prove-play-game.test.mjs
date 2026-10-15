import { JSDOM } from "jsdom";
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

/**
 * A page's document from its markup. jsdom lays nothing out, so an element's innerText is its text as written.
 */
const documentOf = (markup) => {
  const { window } = new JSDOM(`<body>${markup}</body>`);
  Object.defineProperty(window.HTMLElement.prototype, "innerText", {
    get() {
      return this.textContent;
    },
  });
  return window.document;
};

/**
 * A browser on a live map whose page is `page()`, markup read again at each evaluation and queried as the runner's
 * selectors query it, and whose clicks and keys run `onPress`: what a task's presses change is up to each test.
 */
const liveMapBrowser = ({ page, onPress = () => {} }) => ({
  run: (command, ...args) => {
    if ((command === "mouse" && args[0] === "up") || ["press", "find", "click"].includes(command)) onPress(command);
    if (command === "errors") return JSON.stringify({ success: true, data: { errors: [] } });
    if (command === "console") return JSON.stringify({ success: true, data: { messages: [] } });
    return "";
  },
  evaluate: (js) => {
    if (js.includes("dataset.bootState")) return true;
    // A control the task names is on the page: the runner marks it, then clicks it.
    if (js.includes("data-proof-press")) return "[data-proof-press]";
    return Function("document", `return (${js})`)(documentOf(page()));
  },
});

/** The action strip as the HUD renders it: its Build button carries the Build workspace's name. */
const STRIP = `<nav aria-label="Structure actions"><button aria-label="Build">Build</button></nav>`;

const proveTask = async (browser, task) => {
  vi.useFakeTimers();
  const proof = proveGame(browser, { baseUrl: "https://proof.test", game: "0xa:11", tasks: [task] }, "/proof");
  await vi.runAllTimersAsync();
  return (await proof).records;
};

describe("a task that changes the game", () => {
  it("fails an explore when only an old success line goes away", async () => {
    let oldToast = true;
    const records = await proveTask(
      liveMapBrowser({
        page: () => `<p>Explore</p>\n<p>${oldToast ? "Scouts sent" : ""}</p>`,
        onPress: () => (oldToast = false),
      }),
      "blitz-explore",
    );
    expect(records[0].problem).toBe("the task's reading was unavailable");
  });

  it("fails an explore whose army stays on its tile, as a refused or no-op order leaves it", async () => {
    const records = await proveTask(
      liveMapBrowser({ page: () => "<p>Army Tile · (1, 6)</p>\n<p>Explore</p>" }),
      "blitz-explore",
    );
    expect(records[0].problem).toBe('expected the army on another tile, read "(1, 6)" → "(1, 6)"');
  });

  it("passes an explore whose army moves onto the explored tile", async () => {
    let tile = "(1, 6)";
    const records = await proveTask(
      liveMapBrowser({
        page: () => `<p>Army Tile · ${tile}</p>\n<p>Explore</p>`,
        onPress: (command) => command === "mouse" && (tile = "(2, 5)"),
      }),
      "blitz-explore",
    );
    expect(records[0]).toMatchObject({ done: true, reading: { before: "(1, 6)", after: "(2, 5)" } });
    expect(records[0].problem).toBeUndefined();
  });

  it("fails a farm when the Build panel only opens", async () => {
    const records = await proveTask(
      liveMapBrowser({ page: () => `${STRIP}<section aria-label="Build">Built here\n3 total</section>` }),
      "blitz-farm",
    );
    expect(records.map((record) => record.problem)).toEqual(
      Array(2).fill("expected one more building in the realm, read 3 → 3"),
    );
  });

  it("passes a farm once the realm has one more building, at both sizes", async () => {
    let presses = 0;
    let built = 3;
    const records = await proveTask(
      liveMapBrowser({
        page: () => `${STRIP}<section aria-label="Build">Built here\n${built} total</section>`,
        // The second press of each run is the farm's order: Build, then Farm.
        onPress: () => (presses += 1) % 2 === 0 && (built += 1),
      }),
      "blitz-farm",
    );
    expect(
      records.map((record) => [
        record.layout,
        record.clicks,
        record.inputs.map((input) => input.name),
        record.problem,
        record.reading,
      ]),
    ).toEqual([
      ["desktop", 2, ["Build", "Farm"], undefined, { before: 3, after: 4 }],
      ["phone", 2, ["Build", "Farm's Build"], undefined, { before: 4, after: 5 }],
    ]);
  });
});

describe("an action tried before play opens", () => {
  it("passes when the press opens nothing and the player is told when play opens", async () => {
    const records = await proveTask(liveMapBrowser({ page: () => `${STRIP}\n<p>Starts in 2m 10s</p>` }), "gate-build");
    expect(records.map((record) => [record.layout, record.problem, record.reading])).toEqual([
      ["desktop", undefined, { before: 0, after: 0 }],
      ["phone", undefined, { before: 0, after: 0 }],
    ]);
  });

  it("fails when an order surface opens anyway", async () => {
    let open = false;
    const records = await proveTask(
      liveMapBrowser({
        page: () =>
          `<button aria-label="Manage production"></button>\n<p>Starts in 2m 10s</p>${open ? '<section aria-label="Production"></section>' : ""}`,
        onPress: () => (open = true),
      }),
      "gate-production",
    );
    expect(records[0].problem).toBe("expected no order surface to open, read 0 → 1");
  });
});
