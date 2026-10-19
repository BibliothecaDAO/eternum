/**
 * The app sheet's captures: the app's real pages over the app lab's fixtures (/lab/app/<screen>/<page>), each element of
 * the app sheet (/lab/kit/app, by its `data-sheet-element`). The pages the sheet has moved (Play, the Blitz lobby,
 * Season, Results sealed and opened, What's new) are shot at 1920×1080 and on a phone at 390×844, and checked; the
 * app's other pages are shot on the desktop, under the same frame.
 *
 *   pnpm --dir apps/game prove:app <base-url> <out-dir> [pages|others|sheet|end-map] [--state <signed-in.json>]
 *
 * `end-map` runs on the live stack the client is served against, alone: the newest finished game's Results, its "See
 * the end map" pressed, and the map it opens held until its scene is ready, watched and never played.
 */
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { clickAsPlayer, pathOf, runProof, sleep, waitFor } from "./prove-run.mjs";

const VIEWPORT = ["1920", "1080"];
const PHONE = ["390", "844"];
const READY_MS = 30_000;
const SETTLE_MS = 2_000;

/**
 * The pages on the app sheet, each over the fixture state it is checked in, with the place lit in the bar while it is
 * open (none on a full-screen step: the lobby).
 */
const SHEET_PAGES = {
  play: { path: "home", place: "Play" },
  // Play as a seated player sees it: the seat's Blitz leads, the open slot's Join in Blitz's column under it.
  "play-seated": { path: "blitz-seat", place: "Play" },
  // The same with the slot's entry closing hours away: the longer clock QA met on dev, wrapping on a phone.
  "play-seated-late-slot": { path: "blitz-seat-late-slot", place: "Play" },
  lobby: { path: "entry-choose/blitz/slot-blitz-1630", place: null },
  // A launched game's lobby: its roster, the player's own seat ringed, and Enter.
  "lobby-game": { path: "blitz-seat/blitz/game-0x5245414c4d53-7", place: null },
  season: { path: "season-running/season", place: "Season" },
  results: { path: "reward-sealed/results/0x5245414c4d53-7", place: "You" },
  "results-opened": { path: "reward-lords/results/0x5245414c4d53-7", place: "You" },
  "whats-new": { path: "home/scroll", place: "What's new" },
};

/**
 * The bars at their limits: on the desktop, the longest name an account takes beside Play's install notice, at the
 * desktop's narrowest width and a laptop's; on a phone, the places at the narrowest phone the app is held to.
 */
const BAR_CASES = [
  { name: "bar-long-name-1024", path: "long-name", viewport: ["1024", "768"], desktop: true, place: "Play" },
  { name: "bar-long-name-1440", path: "long-name", viewport: ["1440", "900"], desktop: true, place: "Play" },
  { name: "tabs-phone-360", path: "home/scroll", viewport: ["360", "640"], desktop: false, place: "What's new" },
];

/**
 * The lobby's entry with every choice taken (the sword and the shield beside the seat), at a desktop, the desktop's
 * narrowest width and a phone: each choice's price or credit stays inside its choice, and the entry's balance and total
 * inside its panel.
 */
const ENTRY_CASES = [
  { name: "entry-all-1920", viewport: ["1920", "1080"] },
  { name: "entry-all-1024", viewport: ["1024", "768"] },
  { name: "entry-all-390", viewport: ["390", "844"] },
].map((entry) => ({ ...entry, path: "/lab/app/entry-choose/blitz/slot-blitz-1630?capture=1" }));

/** Takes every choice of the entry not yet taken, as a player's clicks would. */
const takeEveryChoice = async (b) => {
  const untaken = b.evaluate(`[...document.querySelectorAll('.app-choice[aria-pressed="false"]:enabled')].length`);
  for (let index = 0; index < untaken; index += 1) {
    b.run("click", '.app-choice[aria-pressed="false"]:enabled');
    await sleep(300);
  }
};

const entryChecks = (b) => {
  const entry = b.evaluate(`(() => {
    const inside = (outer, element) => {
      const box = outer.getBoundingClientRect();
      return [...element.querySelectorAll("*")].map((part) => part.getBoundingClientRect()).filter((rect) => rect.width > 0)
        .every((rect) => rect.left >= box.left - 1 && rect.right <= box.right + 1 && rect.top >= box.top - 1 && rect.bottom <= box.bottom + 1);
    };
    const choices = [...document.querySelectorAll(".app-choice")];
    const panel = choices[0]?.closest(".app-panel");
    return {
      taken: choices.map((choice) => choice.getAttribute("aria-pressed")),
      choicesHold: choices.map((choice) => ({ word: choice.querySelector(".app-choice__title")?.textContent, holds: inside(choice, choice) })),
      total: panel?.querySelector(".app-figure__value")?.textContent ?? null,
      panelHolds: panel ? inside(panel, panel) : false,
    };
  })()`);
  return [
    {
      check: "every choice taken",
      ok: entry.taken.length === 3 && entry.taken.every((taken) => taken === "true"),
      entry,
    },
    { check: "each price or credit stays inside its choice", ok: entry.choicesHold.every((choice) => choice.holds) },
    { check: "the balance and the total stay inside the entry", ok: entry.panelHolds },
  ];
};

/** The app's other pages: still drawn with the shell kit inside the sheet's frame. */
const OTHER_PAGES = {
  "first-visit": "first-visit",
  you: "home/profile",
  settings: "home/profile/settings",
  "sign-in": "first-visit/sign-in/start",
};

/** What holds for a page drawn whole: it did not fall to the error boundary, and it does not scroll sideways. */
const pageChecks = (b) => [
  {
    check: "drawn, not the error boundary",
    ok: b.evaluate(`!document.body.innerText.includes("Something went wrong")`),
  },
  { check: "no horizontal overflow", ok: b.evaluate("document.documentElement.scrollWidth <= innerWidth") },
];

const shoot = async (b, baseUrl, out, { name, path, act, more }) => {
  b.run("open", `${baseUrl}${path}`, "--ignore-https-errors");
  const record = { name, ready: await waitFor(b, DRAWN, READY_MS), presses: [], checks: [] };
  if (!record.ready) return record;
  await sleep(SETTLE_MS);
  await act?.(b);
  b.run("screenshot", join(out, `${name}.png`));
  record.checks.push(...pageChecks(b), ...(more?.(b) ?? []));
  return record;
};

const DRAWN = `document.querySelector("[data-layout]") !== null`;

const otherPages = () =>
  Object.entries(OTHER_PAGES).map(([page, path]) => ({ name: `other-${page}`, path: `/lab/app/${path}?capture=1` }));

/**
 * What holds for each page on the app sheet: nothing drawn spills out of its block, every picture on it loaded (the
 * painting, icons, portraits, the chest), it has at most one gold verb, and its place is the one lit among the places;
 * on the desktop it also stands on its painting and the bar ends on the player, on a phone each place's word reads
 * whole. The glyphs it draws are counted.
 */
const sheetPageChecks = (page) => (b) => {
  const { desktop, place } = page;
  const measure = b.evaluate(`(() => {
    // How far anything a block shows runs past the block's foot or its right side. Decoration (aria-hidden: a stage's
    // rays) may run past and be cut; content that is cut is the defect this catches, so it counts whole.
    const rectOf = (element) => element.getBoundingClientRect();
    const spillOf = (block) => {
      const box = rectOf(block);
      const inside = [...block.querySelectorAll("*")]
        .filter((element) => !element.closest('[aria-hidden="true"]'))
        .map(rectOf)
        .filter((rect) => rect.width > 0 && rect.height > 0);
      return Math.max(0, ...inside.map((rect) => Math.max(rect.bottom - box.bottom, rect.right - box.right)));
    };
    const body = document.querySelector('[data-band="body"]');
    const blocks = body ? [...body.querySelectorAll(":scope > * > *, :scope > *")] : [];
    const bar = document.querySelector('[data-band="bar"]')?.getBoundingClientRect();
    const player = document.querySelector(".app-bar__end > :last-child")?.getBoundingClientRect();
    return {
      spill: Math.round(Math.max(0, ...blocks.map(spillOf))),
      height: document.documentElement.scrollHeight,
      glyphs: document.querySelectorAll("[data-icon]").length,
      painting: document.querySelector(".app-frame__painting")?.naturalWidth > 0,
      broken: [...document.querySelectorAll("img")]
        .filter((image) => !(image.complete && image.naturalWidth > 0))
        .map((image) => image.currentSrc || image.src),
      goldVerbs: document.querySelectorAll('.app-button[data-kind="primary"], .frontier-primary').length,
      // Each age column's band of painting above its games, as computed.
      ageBands: [...document.querySelectorAll(".app-age-column__body")].map((body) => getComputedStyle(body).paddingTop),
      // A phone's first screen ends where its notice or foot row begins: a control straddling that edge is half hidden.
      cutAtEdge: (() => {
        const bands = ["notice", "foot", "tabs"].map((name) => document.querySelector('[data-band="' + name + '"]')).filter(Boolean);
        if (!body || bands.length === 0) return [];
        const edge = Math.min(...bands.map((band) => band.getBoundingClientRect().top));
        return [...body.querySelectorAll("a[href], button")]
          .map((control) => ({ word: control.innerText.trim().slice(0, 30), rect: control.getBoundingClientRect() }))
          .filter(({ rect }) => rect.height > 0 && rect.top < edge - 1 && rect.bottom > edge + 1)
          .map(({ word, rect }) => word + " " + Math.round(rect.top) + "→" + Math.round(rect.bottom) + " at " + Math.round(edge));
      })(),
      places: document.querySelectorAll('[data-band="bar"] [data-role="tab"]').length,
      // The places lit as the page's own, by their word ("You: Maelis" is You), and any place whose word is cut.
      lit: [...document.querySelectorAll('[data-role="tab"][aria-current="page"]')].map((tab) => (tab.getAttribute("aria-label") ?? tab.innerText).split(":")[0].trim()),
      // A word cut short, pushed off the screen, or wrapped onto a second line.
      placesCut: [...document.querySelectorAll('[data-role="tab"]')]
        .filter((tab) => {
          const texts = document.createTreeWalker(tab, NodeFilter.SHOW_TEXT);
          const lines = new Set();
          while (texts.nextNode()) {
            const word = document.createRange();
            word.selectNodeContents(texts.currentNode);
            for (const rect of word.getClientRects()) if (rect.width > 0) lines.add(Math.round(rect.top));
          }
          return tab.scrollWidth > tab.clientWidth + 1 || tab.getBoundingClientRect().right > innerWidth + 1 || lines.size > 1;
        })
        .map((tab) => tab.innerText.trim()),
      playerRightGap: bar && player ? Math.round(bar.right - player.right) : null,
    };
  })()`);
  return [
    { check: "nothing spills out of its block", ok: measure.spill <= 1, measure },
    { check: "every picture loaded", ok: measure.broken.length === 0 },
    { check: "at most one gold verb", ok: measure.goldVerbs <= 1 },
    {
      check: "its place is the one lit, or a full-screen step lights none",
      ok: JSON.stringify(measure.lit) === JSON.stringify(place === null ? [] : [place]),
    },
    {
      check: "an age's band of painting is 96 px on a desktop, 64 px on a phone",
      ok: measure.ageBands.every((band) => band === (desktop ? "96px" : "64px")),
    },
    ...(desktop
      ? []
      : [
          { check: "no control cut by the phone's notice or foot", ok: measure.cutAtEdge.length === 0 },
          { check: "each place's word reads whole", ok: measure.placesCut.length === 0 },
        ]),
    ...(desktop
      ? [
          ...barChecks(b),
          { check: "stands on its painting", ok: measure.painting },
          // A full-screen step (the lobby) keeps the mark and the notice alone.
          {
            check: "the bar ends on the player, or holds no places",
            ok: measure.places === 0 || (measure.playerRightGap !== null && measure.playerRightGap <= 48),
          },
        ]
      : []),
  ];
};

/**
 * What holds for the desktop bar: everything drawn in it stays inside its bounds, its mark keeps its width, and each of
 * its controls is whole and on the screen.
 */
const barChecks = (b) => {
  const bar = b.evaluate(`(() => {
    const bar = document.querySelector('[data-band="bar"]');
    const box = bar.getBoundingClientRect();
    const drawn = [...bar.querySelectorAll("*")].filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && getComputedStyle(element).visibility !== "hidden";
    });
    const outside = drawn
      .map((element) => ({ element, rect: element.getBoundingClientRect() }))
      .filter(({ rect }) => rect.top < box.top - 1 || rect.bottom > box.bottom + 1 || rect.left < box.left - 1 || rect.right > box.right + 1)
      .map(({ element, rect }) => element.tagName.toLowerCase() + " " + (element.textContent ?? "").slice(0, 30) + " " + Math.round(rect.top) + "→" + Math.round(rect.bottom));
    const controls = [...bar.querySelectorAll("a[href], button")].map((control) => {
      const rect = control.getBoundingClientRect();
      return { text: control.textContent.trim().slice(0, 30), whole: control.scrollWidth <= control.clientWidth + 1, onScreen: rect.left >= 0 && rect.right <= innerWidth && rect.width >= 24 };
    });
    return {
      height: Math.round(box.height),
      outside,
      markWidth: Math.round(bar.querySelector('[data-role="lockup"] img')?.getBoundingClientRect().width ?? 0),
      controls,
    };
  })()`);
  return [
    { check: "the bar's contents stay inside it", ok: bar.outside.length === 0, bar },
    { check: "the bar's mark keeps its width", ok: bar.markWidth >= 100 },
    { check: "the bar's controls are whole and on the screen", ok: bar.controls.every((control) => control.onScreen) },
  ];
};

const barCases = () =>
  BAR_CASES.map((bar) => ({ ...bar, path: `/lab/app/${bar.path}?capture=1`, more: sheetPageChecks(bar) }));

const sheetPages = (desktop) =>
  Object.entries(SHEET_PAGES).map(([page, { path, place }]) => ({
    name: `${desktop ? "app" : "phone"}-${page}`,
    path: `/lab/app/${path}?capture=1`,
    more: sheetPageChecks({ desktop, place }),
  }));

/** An element's name as a file name: "Game card" is sheet-game-card.png. */
const fileOf = (name) =>
  `sheet-${name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}.png`;

const sheetElements = async (b, baseUrl, out) => {
  b.run("open", `${baseUrl}/lab/kit/app?capture=1`, "--ignore-https-errors");
  if (!(await waitFor(b, `document.querySelector("[data-sheet-element]") !== null`, READY_MS)))
    return [{ name: "the app sheet", ready: false, presses: [] }];
  await sleep(SETTLE_MS);
  const names = b.evaluate(
    `[...document.querySelectorAll("[data-sheet-element]")].map((element) => element.dataset.sheetElement)`,
  );
  return names.map((name) => {
    const selector = `[data-sheet-element="${name}"]`;
    // An element taller than the screen is shot whole on a screen grown to hold it.
    const height = b.evaluate(`Math.ceil(document.querySelector('${selector}').getBoundingClientRect().height)`);
    b.run("set", "viewport", VIEWPORT[0], String(Math.max(Number(VIEWPORT[1]), height + 32)));
    b.run("scrollintoview", selector);
    b.run("screenshot", selector, join(out, fileOf(name)));
    b.run("set", "viewport", ...VIEWPORT);
    return { name: `sheet: ${name}`, ready: true, presses: [], checks: [] };
  });
};

/** A game's map once a player can use it: its scene's route, and the entry's own "world-interactive" milestone. */
const SCENE_READY = `/\\/(map|hex)$/.test(location.pathname) && (window.__eternumGameEntryTimeline ?? []).some((entry) => entry.name === "world-interactive")`;
/** A finished game's map loads its whole end state before its scene is ready. */
const END_MAP_MS = 180_000;

/** The newest settled game in the directory's history, as the app reads it, or null when there is none. */
const NEWEST_FINISHED = `(async () => {
  const history = await (await fetch("/api/directory/history?limit=1", { cache: "no-store" })).json();
  const game = history.games?.[0];
  return game ? { chainId: game.chainId, gameId: game.game_id, name: game.name, status: game.status } : null;
})()`;

/** Marks the Results page's "See the end map" for the browser's click; false when the page has none. */
const MARK_END_MAP = `(() => {
  const button = [...document.querySelectorAll("button")].find((candidate) => candidate.innerText.trim() === "See the end map");
  button?.setAttribute("data-proof-press", "end-map");
  return button !== undefined;
})()`;

/**
 * The fixture Results' "See the end map", pressed: it must lead to the game's own entry as a spectator, the address
 * Play's Watch uses (play-route.ts, buildEntryHref). The game page it opens is left at once: its fixture chain is not
 * a live one.
 */
const END_MAP_ADDRESS = {
  path: "/lab/app/reward-sealed/results/0x5245414c4d53-7?capture=1",
  leads: "/g/0x5245414c4d53/7?spectate=true",
};

const proveEndMapAddress = async (b, baseUrl) => {
  const record = { name: "results-end-map", ready: false, presses: [], checks: [] };
  b.run("open", `${baseUrl}${END_MAP_ADDRESS.path}`, "--ignore-https-errors");
  if (!(await waitFor(b, MARK_END_MAP, READY_MS))) return { ...record, error: "no See the end map on the Results" };
  const refused = clickAsPlayer(b, '[data-proof-press="end-map"]');
  await waitFor(b, `location.pathname.startsWith("/g/")`, READY_MS);
  const led = pathOf(b.url());
  b.run("open", "about:blank");
  record.presses.push({ press: "See the end map", status: refused ?? "led", led });
  record.checks.push({ check: "See the end map leads to the game, watched", ok: led === END_MAP_ADDRESS.leads, led });
  record.ready = true;
  return record;
};

const SEEN_ON_THE_MAP = `({
  path: location.pathname + location.search,
  canvas: document.querySelector("canvas") !== null,
  hud: ["Spectating", "Game finished"].filter((word) => document.body.innerText.includes(word)),
  refused: document.body.innerText.includes("This game has ended."),
  standings: [...document.querySelectorAll('.ui-table-row[aria-label$=" points"]')].map((row) => row.getAttribute("aria-label")),
  noStandings: document.body.innerText.includes("No points scored yet"),
  // A signed-in spectator's identity chip reads "Spectating", then "as <name>".
  spectatingAs: /Spectating\\s+as (\\S+)/.exec(document.body.innerText)?.[1] ?? null,
})`;

/**
 * A finished game's end map, from the app: its Results opened as anyone reads them, "See the end map" pressed as a
 * player presses it, and the map it opens held until its scene is ready, its standings ranking the game's players.
 * With a saved signed-in state (`--state <file>`, agent-browser's `state save`) the spectator is a signed-in player,
 * whose account connects to the game once it is open. The game's page is left once shot.
 */
const proveEndMap = async (b, baseUrl, out, state) => {
  const record = { name: state ? "end-map-signed-in" : "end-map", ready: false, presses: [], checks: [] };
  if (state) b.run("--state", state, "open", "about:blank");
  b.run("open", `${baseUrl}/`, "--ignore-https-errors");
  record.game = (await waitFor(b, DRAWN, READY_MS)) ? b.evaluate(NEWEST_FINISHED) : null;
  if (!record.game) return { ...record, error: "no finished game in the directory's history" };
  const { chainId, gameId } = record.game;
  b.run("open", `${baseUrl}/results/${chainId}-${gameId}`, "--ignore-https-errors");
  if (!(await waitFor(b, `${MARK_END_MAP}`, READY_MS)))
    return { ...record, error: "no See the end map on its Results" };
  await sleep(SETTLE_MS);
  b.run("screenshot", join(out, "end-map-1-results.png"));
  const refused = clickAsPlayer(b, '[data-proof-press="end-map"]');
  const reached = refused === null && (await waitFor(b, SCENE_READY, END_MAP_MS));
  record.presses.push({
    press: "See the end map",
    status: reached ? "led" : (refused ?? "failed"),
    led: pathOf(b.url()),
  });
  await sleep(SETTLE_MS * 2);
  b.run("screenshot", join(out, "end-map-2-map.png"));
  const seen = b.evaluate(SEEN_ON_THE_MAP);
  record.checks.push(
    { check: "it opens the finished game", ok: seen.path.startsWith(`/g/${chainId.toLowerCase()}/${gameId}/`), seen },
    { check: "watched, not played", ok: seen.path.includes("spectate=true") },
    { check: "its map draws, the doorway gone", ok: seen.canvas && !seen.refused },
    { check: "the HUD says it is watched and finished", ok: seen.hud.length === 2 },
    // A store left incomplete reads a player who never scored as unknown, and the standings empty.
    { check: "its standings rank the game's players", ok: seen.standings.length > 0 && !seen.noStandings },
    ...(state
      ? [
          {
            check: "the identity chip names the signed-in player, spectating",
            ok: seen.spectatingAs !== null,
          },
        ]
      : []),
  );
  b.run("open", "about:blank");
  record.ready = true;
  return record;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const baseUrl = (process.argv[2] ?? "https://127.0.0.1:4176").replace(/\/$/, "");
  const parts = process.argv[4]?.split(",") ?? ["pages", "others", "sheet"];
  const stateAt = process.argv.indexOf("--state");
  const state = stateAt === -1 ? null : process.argv[stateAt + 1];
  await runProof(
    {
      parent: resolve(process.argv[3] ?? ".context/app-sheet"),
      name: "app-sheet",
      baseUrl,
      where: (record) => ({ name: record.name }),
    },
    async (b, out, records) => {
      b.run("set", "viewport", ...VIEWPORT);
      if (parts.includes("pages"))
        for (const page of sheetPages(true)) records.push(await shoot(b, baseUrl, out, page));
      if (parts.includes("others")) for (const page of otherPages()) records.push(await shoot(b, baseUrl, out, page));
      if (parts.includes("sheet")) records.push(...(await sheetElements(b, baseUrl, out)));
      if (parts.includes("end-map")) records.push(await proveEndMap(b, baseUrl, out, state));
      if (parts.includes("pages")) {
        for (const bar of barCases()) {
          b.run("set", "viewport", ...bar.viewport);
          records.push(await shoot(b, baseUrl, out, bar));
        }
        records.push(await proveEndMapAddress(b, baseUrl));
        for (const entry of ENTRY_CASES) {
          b.run("set", "viewport", ...entry.viewport);
          records.push(await shoot(b, baseUrl, out, { ...entry, act: takeEveryChoice, more: entryChecks }));
        }
        b.run("set", "viewport", ...PHONE);
        for (const page of sheetPages(false)) records.push(await shoot(b, baseUrl, out, page));
        b.run("set", "viewport", ...VIEWPORT);
      }
    },
  );
}
