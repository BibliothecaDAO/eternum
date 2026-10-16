import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { readFileSync } from "node:fs";

import {
  gameAddresses,
  HISTORY,
  judgeStep,
  linesBetween,
  LOG_BUTTON,
  proveGame,
  spiralPoints,
} from "./prove-play-game.mjs";
import { parseArgs } from "./prove-play.mjs";
import { proveTask as proveSharedTask } from "./game-task-proof.mjs";

const WAR_RELICS = ["Damage Relic I", "Damage Reduction Relic I", "Stamina Relic I"];
const LUCKY_FORTRESS_RELICS = ["Structure Defense Relic II", "Damage Reduction Relic II", "Troop Production Relic II"];

/**
 * The pages a War crate shows: the closed panel, the opened panel, and the history **Log** opens after a reload, as
 * `EventLogPanel` heads it.
 */
const WAR_CRATE_PAGES = {
  panel: ["Crate #12", "Contents", "War pack", ...WAR_RELICS, "Victory points", "250", "Open", "Biome", "Bare"],
  opened: ["Crate opened", "Contents", ...WAR_RELICS, "Biome", "Bare"],
  log: [
    "World history",
    "War pack opened",
    `Stolsli T1 army · ${WAR_RELICS.join(", ")}`,
    "+120 Essence",
    "Stolsli T1 army · Reveal",
  ],
};

/** The right column's quick feed as `QuickFeed` renders it with the log closed. */
const QUICK_FEED = `<div aria-label="Quick feed"><button type="button" aria-label="Log" aria-expanded="false">Log</button></div>`;

/** A War crate as the proof reads it: the closed panel's pack, the opened panel and the log after a reload. */
const WAR_CRATE = {
  step: "crate",
  panel: { contents: linesBetween(WAR_CRATE_PAGES.panel.join("\n"), "Contents", "Open") },
  opened: WAR_RELICS,
  log: WAR_CRATE_PAGES.log.slice(1, 3),
  pageErrors: { errors: [], console: [] },
};

const crateWith = (change) => judgeStep({ ...WAR_CRATE, ...change });
const luckyFortress = (relics) => ({
  panel: { contents: ["Fortress pack · lucky", ...relics, "Victory points", "250"] },
  opened: relics,
  log: ["Fortress pack · lucky opened", `Stolsli T1 army · ${relics.join(", ")}`],
});

/**
 * A browser on a running game with a War crate in the middle of the map, whose page is a DOM every check of the proof
 * runs against: hovering names the crate, a click opens its panel, **Open** opens it, a reload shows the map with its
 * quick feed, and only a click on the feed's **Log** (when `logOpensHistory`) shows the history.
 */
const crateBrowser = ({ pages = WAR_CRATE_PAGES, feed = QUICK_FEED, logOpensHistory = true } = {}) => {
  const { window } = new JSDOM("<!doctype html><body></body>");
  const { document } = window;
  // jsdom lays nothing out: a block's text is its children's, one per line, and every element has a size.
  Object.defineProperty(window.HTMLElement.prototype, "innerText", {
    get() {
      return this.children.length ? [...this.children].map((child) => child.innerText).join("\n") : this.textContent;
    },
  });
  window.HTMLElement.prototype.getBoundingClientRect = () => ({ width: 1, height: 1 });
  document.documentElement.dataset.bootState = "app-ready";
  const show = (lines, withFeed = false) => {
    const items = lines.map((line) => (line === "Open" ? `<button type="button">Open</button>` : `<p>${line}</p>`));
    document.body.innerHTML = `<canvas></canvas>${withFeed ? feed : ""}<main>${items.join("")}</main>`;
  };
  const showHistory = () => {
    const history = document.createElement("section");
    history.setAttribute("aria-label", "World history");
    history.innerHTML = pages.log.map((line) => `<p>${line}</p>`).join("");
    document.body.append(history);
  };
  show(["Relic Crate"]);
  const answer = (data) => JSON.stringify({ success: true, data, error: null });
  return {
    run: (command, ...args) => {
      if (command === "mouse" && args[0] === "down") show(pages.panel);
      if (command === "click") {
        const target = document.querySelector(args[0]);
        if (target?.innerText === "Open") show(pages.opened);
        if (target?.matches(LOG_BUTTON) && logOpensHistory) showHistory();
      }
      if (command === "reload") show(["Stolsli T1 army"], true);
      if (command === "errors") return answer({ errors: [] });
      if (command === "console") return answer({ messages: [] });
      return "";
    },
    evaluate: (js) => Function("document", `return (${js})`)(document),
  };
};

const proveCrate = async (browser) => {
  vi.useFakeTimers();
  const proof = proveGame(browser, { baseUrl: "https://proof.test", game: "0xa:7", crate: [3, 11] }, "/proof");
  await vi.runAllTimersAsync();
  return (await proof).records[0];
};

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

  it("reads a closed crate's pack and an opened crate's relics off its panel", () => {
    expect(WAR_CRATE.panel.contents).toEqual(["War pack", ...WAR_RELICS, "Victory points", "250"]);
    expect(linesBetween(WAR_CRATE_PAGES.opened.join("\n"), "Contents", "Biome")).toEqual(WAR_RELICS);
    expect(linesBetween("Crate opened\nBiome\nBare", "Contents", "Biome")).toEqual([]);
  });

  it("passes a crate whose opened panel and log name exactly the pack its panel advertised", () => {
    expect(judgeStep(WAR_CRATE).problem).toBeUndefined();
    expect(crateWith(luckyFortress(LUCKY_FORTRESS_RELICS)).problem).toBeUndefined();
  });

  it("fails a crate whose closed panel names no pack or not three relics", () => {
    expect(crateWith({ panel: { contents: ["Relics", "3", "Victory points", "250"] } }).problem).toBe(
      "the closed crate's panel named no pack",
    );
    expect(crateWith({ panel: { contents: [] } }).problem).toBe("the closed crate's panel named no pack");
    expect(crateWith({ panel: { contents: ["War pack", ...WAR_RELICS.slice(1), "Victory points"] } }).problem).toBe(
      "the panel advertised 2 relics in the War pack, not 3",
    );
  });

  it("fails a pack whose relics are not all of its level", () => {
    const mixed = ["Structure Defense Relic II", "Damage Reduction Relic I", "Troop Production Relic II"];
    expect(crateWith(luckyFortress(mixed)).problem).toBe("the Fortress pack · lucky lists relics of the wrong level");
    const lucky = ["Damage Relic II", "Damage Reduction Relic II", "Stamina Relic II"];
    expect(crateWith({ panel: { contents: ["War pack", ...lucky] }, opened: lucky }).problem).toBe(
      "the War pack lists relics of the wrong level",
    );
  });

  it("fails a crate that opens missing, duplicated or other relics than advertised", () => {
    const problem = "the opened crate lists other relics than the War pack advertised";
    expect(crateWith({ opened: [] }).problem).toBe(problem);
    expect(crateWith({ opened: WAR_RELICS.slice(1) }).problem).toBe(problem);
    expect(crateWith({ opened: ["Damage Relic I", "Stamina Relic I", "Stamina Relic I"] }).problem).toBe(problem);
    expect(crateWith({ opened: ["Damage Relic II", "Damage Reduction Relic I", "Stamina Relic I"] }).problem).toBe(
      problem,
    );
  });

  it("fails a crate the log does not hold, or names otherwise, after the reload", () => {
    expect(crateWith({ log: [] }).problem).toBe('the log holds no "War pack opened" after the reload');
    expect(crateWith({ log: ["Relic crate opened", WAR_CRATE.log[1]] }).problem).toBe(
      'the log holds no "War pack opened" after the reload',
    );
    expect(crateWith({ log: ["War pack opened", "Stolsli T1 army · Damage Relic I, Stamina Relic I"] }).problem).toBe(
      "the log names other relics than the panel",
    );
  });

  it("opens history through the controls the game renders", () => {
    const feed = readFileSync(new URL("../src/ui/features/event-feed/quick-feed.tsx", import.meta.url), "utf8");
    const panel = readFileSync(new URL("../src/ui/features/event-feed/event-log-panel.tsx", import.meta.url), "utf8");
    expect(LOG_BUTTON).toBe('button[aria-label="Log"]');
    expect(feed).toMatch(/<button[^>]*aria-label="Log"/);
    expect(HISTORY).toBe('section[aria-label="World history"]');
    expect(panel).toContain('<section aria-label="World history">');
  });

  it("drives a crate from the pointer to its history after a reload, opened by Log", async () => {
    const record = await proveCrate(crateBrowser());
    expect(record.problem).toBeUndefined();
    expect(record.found).toEqual([720, 450]);
    expect(record.panel.contents).toEqual(WAR_CRATE.panel.contents);
    expect(record.opened).toEqual(WAR_RELICS);
    expect(record.log).toEqual(WAR_CRATE.log);
  });

  it("fails a driven crate when the page has no Log, or Log opens no history", async () => {
    const withoutLog = await proveCrate(
      crateBrowser({ feed: "<section><h2>Events</h2><button>All</button></section>" }),
    );
    expect(withoutLog.problem).toBe("no Log button to open the history");
    expect(withoutLog.log).toBeUndefined();
    const closed = await proveCrate(crateBrowser({ logOpensHistory: false }));
    expect(closed.problem).toBe("Log opened no history");
  });

  it("fails a driven crate whose history still titles the opening the old way", async () => {
    const log = ["World history", "Relic crate opened", `Stolsli T1 army · ${WAR_RELICS.join(", ")}`];
    const record = await proveCrate(crateBrowser({ pages: { ...WAR_CRATE_PAGES, log } }));
    expect(record.problem).toBe('the log holds no "War pack opened" after the reload');
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
  // Nor does it lay anything out: an element's box is its `data-box` ("left,top,width,height") on a 1440×900 screen.
  window.Element.prototype.getBoundingClientRect = function () {
    const [left, top, width, height] = (this.dataset.box ?? "0,0,0,0").split(",").map(Number);
    return { left, top, width, height, right: left + width, bottom: top + height };
  };
  return window.document;
};

const SCREEN = { innerWidth: 1440, innerHeight: 900 };

/**
 * A browser on a live map whose page is `page()`, markup read again at each evaluation and queried as the runner's
 * selectors query it, and whose clicks and keys run `onPress`: what a task's presses change is up to each test.
 */
const liveMapBrowser = ({ page, onPress = () => {} }) => ({
  run: (command, ...args) => {
    if (
      (command === "mouse" && args[0] === "up") ||
      ["press", "find", "click", "dblclick", "select", "fill"].includes(command)
    )
      onPress(command, ...args);
    if (command === "errors") return JSON.stringify({ success: true, data: { errors: [] } });
    if (command === "console") return JSON.stringify({ success: true, data: { messages: [] } });
    return "";
  },
  evaluate: (js) => {
    if (js.includes("dataset.bootState")) return true;
    // A control the task names is on the page: the runner marks it, then clicks it.
    if (js.includes("data-proof-press")) return "[data-proof-press]";
    return Function(
      "document",
      "innerWidth",
      "innerHeight",
      `return (${js})`,
    )(documentOf(page()), SCREEN.innerWidth, SCREEN.innerHeight);
  },
});

/** The action strip as the HUD renders it: its Build button carries the Build workspace's name. */
const STRIP = `<nav aria-label="Realm actions"><button aria-label="Build">Build</button></nav>`;

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
      liveMapBrowser({
        page: () => `${STRIP}<section data-popover-panel="build" aria-label="Build">Built here\n3 total</section>`,
      }),
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
        page: () =>
          `${STRIP}<section data-popover-panel="build" aria-label="Build">Built here\n${built} total</section>`,
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

describe("a full modal opened from the map", () => {
  const transferFrom = (box) =>
    proveTask(
      liveMapBrowser({
        page: () =>
          `<p>Troops / Resources</p><section data-popover-panel="help" data-box="${box}">Transfer Troops &amp; Relics</section>`,
      }),
      "blitz-transfer",
    );

  it("passes when Transfer Troops & Relics stands in the middle of the screen", async () => {
    const records = await transferFrom("260,96,920,600");
    expect(records.map((record) => [record.layout, record.clicks, record.problem])).toEqual([
      ["desktop", 2, undefined],
      ["phone", 2, undefined],
    ]);
  });

  it("fails when it hangs from the army's tile, off the screen's edge", async () => {
    const records = await transferFrom("1100,500,920,600");
    expect(records[0].problem).toBe("the task's end state did not show");
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
          `<canvas></canvas>\n<p>Starts in 2m 10s</p>${open ? '<section data-popover-panel="production" aria-label="production"></section>' : ""}`,
        onPress: () => (open = true),
      }),
      "gate-production",
    );
    expect(records[0].problem).toBe("expected no order surface to open, read 0 → 1");
  });
});

describe("connected HUD task outcomes", () => {
  const automationPage = (value) =>
    `<select aria-label="Production automation"><option value="idle" ${value === "idle" ? "selected" : ""}>Idle</option><option value="smart" ${value === "smart" ? "selected" : ""}>Smart</option></select>`;
  it("fails when selecting Idle leaves Smart in place", async () => {
    const records = await proveTask(liveMapBrowser({ page: () => automationPage("smart") }), "hud-automation");
    expect(records.map((record) => record.problem)).toEqual([
      "after Idle automation: expected result did not show",
      "after Idle automation: expected result did not show",
    ]);
  });
  it("awaits the browser's controls and reads the restored automation on both sizes", async () => {
    let value = "smart";
    const browser = liveMapBrowser({
      page: () => automationPage(value),
      onPress: (command, selector, next) => {
        if (command === "select") value = next;
      },
    });
    vi.useFakeTimers();
    const transport = {
      run: async (...args) => {
        await Promise.resolve();
        return browser.run(...args);
      },
      evaluate: async (...args) => browser.evaluate(...args),
    };
    const records = [];
    for (const layout of ["desktop", "phone"]) {
      const proof = proveSharedTask(
        transport,
        "https://proof.test",
        gameAddresses("0xa:11"),
        "hud-automation",
        layout,
        "/proof",
      );
      await vi.runAllTimersAsync();
      records.push(await proof);
    }
    expect(records.map((record) => record.reading)).toEqual([
      { before: "idle", after: "smart" },
      { before: "idle", after: "smart" },
    ]);
    expect(records.every((record) => record.done && !record.problem)).toBe(true);
    expect(value).toBe("smart");
  });
});
