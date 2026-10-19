/**
 * The app sheet's captures: the app's real pages over the app lab's fixtures (/lab/app/<screen>/<page>), each element of
 * the app sheet (/lab/kit/app, by its `data-sheet-element`). The pages the sheet has moved (Play, the Blitz lobby,
 * Season, Results sealed and opened) are shot at 1920×1080 and on a phone at 390×844, and checked; the app's other
 * pages are shot on the desktop, under the same frame.
 *
 *   pnpm --dir apps/game prove:app <base-url> <out-dir> [pages|others|sheet]
 */
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { runProof, sleep, waitFor } from "./prove-run.mjs";

const VIEWPORT = ["1920", "1080"];
const PHONE = ["390", "844"];
const READY_MS = 30_000;
const SETTLE_MS = 2_000;

/** The pages on the app sheet, each over the fixture state it is checked in. */
const SHEET_PAGES = {
  play: "home",
  // Play as a seated player sees it: the seat's Blitz leads, the open slot's Join in Blitz's column under it.
  "play-seated": "blitz-seat",
  lobby: "entry-choose/blitz/slot-blitz-1630",
  // A launched game's lobby: its roster, the player's own seat ringed, and Enter.
  "lobby-game": "blitz-seat/blitz/game-0x5245414c4d53-7",
  season: "season-running/season",
  results: "reward-sealed/results/0x5245414c4d53-7",
  "results-opened": "reward-lords/results/0x5245414c4d53-7",
};

/**
 * The desktop bar at its limits: the longest name an account takes beside Play's install notice, at the desktop's
 * narrowest width and a laptop's.
 */
const BAR_CASES = [
  { name: "bar-long-name-1024", path: "long-name", viewport: ["1024", "768"] },
  { name: "bar-long-name-1440", path: "long-name", viewport: ["1440", "900"] },
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
  news: "home/scroll",
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
 * painting, icons, portraits, the chest), and it has at most one gold verb; on the desktop it also stands on its
 * painting and the bar ends on the player. The glyphs it draws are counted.
 */
const sheetPageChecks = (desktop) => (b) => {
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
      playerRightGap: bar && player ? Math.round(bar.right - player.right) : null,
    };
  })()`);
  return [
    { check: "nothing spills out of its block", ok: measure.spill <= 1, measure },
    { check: "every picture loaded", ok: measure.broken.length === 0 },
    { check: "at most one gold verb", ok: measure.goldVerbs <= 1 },
    ...(desktop ? [] : [{ check: "no control cut by the phone's notice or foot", ok: measure.cutAtEdge.length === 0 }]),
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
  BAR_CASES.map((bar) => ({ ...bar, path: `/lab/app/${bar.path}?capture=1`, more: sheetPageChecks(true) }));

const sheetPages = (desktop) =>
  Object.entries(SHEET_PAGES).map(([page, path]) => ({
    name: `${desktop ? "app" : "phone"}-${page}`,
    path: `/lab/app/${path}?capture=1`,
    more: sheetPageChecks(desktop),
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

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const baseUrl = (process.argv[2] ?? "https://127.0.0.1:4176").replace(/\/$/, "");
  const parts = process.argv[4]?.split(",") ?? ["pages", "others", "sheet"];
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
      if (parts.includes("pages")) {
        for (const bar of barCases()) {
          b.run("set", "viewport", ...bar.viewport);
          records.push(await shoot(b, baseUrl, out, bar));
        }
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
