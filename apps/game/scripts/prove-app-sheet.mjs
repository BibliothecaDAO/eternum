/**
 * The app sheet's captures, one screenshot each at 1920×1080: the app's pages as they are today (the app lab's
 * fixtures, /lab/app/<screen>/<page>), each element of the app sheet (/lab/kit/app, by its `data-sheet-element`), and
 * the app's four most-used pages in their picked desktop directions (/lab/kit/app/<page>). Run before and after the app
 * moves onto its sheet.
 *
 *   pnpm --dir apps/game prove:app <base-url> <out-dir> [today|sheet|pages]
 */
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { runProof, sleep, waitFor } from "./prove-run.mjs";

const VIEWPORT = ["1920", "1080"];
const READY_MS = 30_000;
const SETTLE_MS = 2_000;

/** The pages the app draws today, each over its fixture state: the busiest first. */
const TODAY = {
  play: "home",
  "first-visit": "first-visit",
  lobby: "entry-choose/blitz/slot-blitz-1630",
  season: "season-running/season",
  results: "reward-epic/results/0x5245414c4d53-7",
  you: "home/profile",
  settings: "home/profile/settings",
  "sign-in": "first-visit/sign-in/start",
  news: "home/scroll",
};

const PAGES = ["play", "lobby", "season", "results", "results-opened"];

/** What holds for a page drawn whole: it did not fall to the error boundary, and it does not scroll sideways. */
const pageChecks = (b) => [
  {
    check: "drawn, not the error boundary",
    ok: b.evaluate(`!document.body.innerText.includes("Something went wrong")`),
  },
  { check: "no horizontal overflow", ok: b.evaluate("document.documentElement.scrollWidth <= innerWidth") },
];

const shoot = async (b, baseUrl, out, { name, path, drawn, more }) => {
  b.run("open", `${baseUrl}${path}`, "--ignore-https-errors");
  const record = { name, ready: await waitFor(b, drawn, READY_MS), presses: [], checks: [] };
  if (!record.ready) return record;
  await sleep(SETTLE_MS);
  b.run("screenshot", join(out, `${name}.png`));
  record.checks.push(...pageChecks(b), ...(more?.(b) ?? []));
  return record;
};

const todayPages = () =>
  Object.entries(TODAY).map(([page, path]) => ({
    name: `today-${page}`,
    path: `/lab/app/${path}?capture=1`,
    drawn: `document.querySelector("[data-layout]") !== null`,
  }));

/**
 * What holds for each of the app's pages on its sheet: it fits the screen, it stands on its painting and every picture
 * on it loaded (the painting, icons, portraits, the chest), it has at most one gold verb, and the player sits at the
 * bar's right end. The glyphs it draws are counted.
 */
const appPageChecks = (b) => {
  const measure = b.evaluate(`(() => {
    const bottomOf = (element) => element.getBoundingClientRect().bottom;
    const lowestIn = (element) => Math.max(bottomOf(element), ...[...element.querySelectorAll("*")].map(bottomOf));
    const screen = document.querySelector("[data-app-page]");
    const blocks = [...document.querySelector(".app-frame__page").children];
    const bar = document.querySelector(".app-bar").getBoundingClientRect();
    const player = document.querySelector(".app-bar__player").getBoundingClientRect();
    return {
      overflow: Math.round(
        Math.max(lowestIn(screen) - bottomOf(screen), ...blocks.map((block) => lowestIn(block) - bottomOf(block))),
      ),
      glyphs: document.querySelectorAll("[data-app-page] [data-icon]").length,
      painting: document.querySelector("[data-app-page] .app-frame__painting")?.naturalWidth > 0,
      broken: [...document.querySelectorAll("[data-app-page] img")]
        .filter((image) => !(image.complete && image.naturalWidth > 0))
        .map((image) => image.currentSrc || image.src),
      goldVerbs: document.querySelectorAll('[data-app-page] .app-button[data-kind="primary"]').length,
      playerRightGap: Math.round(bar.right - player.right),
      playerInBar: player.top >= bar.top && player.bottom <= bar.bottom,
    };
  })()`);
  return [
    {
      check: "fits 1920×1080 (nothing below the screen or spilling out of its block)",
      ok: measure.overflow <= 0,
      measure,
    },
    { check: "stands on its painting", ok: measure.painting },
    { check: "every picture loaded", ok: measure.broken.length === 0 },
    { check: "at most one gold verb", ok: measure.goldVerbs <= 1 },
    { check: "the player at the bar's right end", ok: measure.playerInBar && measure.playerRightGap <= 48 },
  ];
};

const appPages = () =>
  PAGES.map((page) => ({
    name: `app-${page}`,
    path: `/lab/kit/app/${page}?capture=1`,
    drawn: `document.querySelector('[data-lab="app-page"]') !== null`,
    more: appPageChecks,
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
  const parts = process.argv[4]?.split(",") ?? ["today", "sheet", "pages"];
  await runProof(
    {
      parent: resolve(process.argv[3] ?? ".context/app-sheet"),
      name: "app-sheet",
      baseUrl,
      where: (record) => ({ name: record.name }),
    },
    async (b, out, records) => {
      b.run("set", "viewport", ...VIEWPORT);
      if (parts.includes("today")) for (const page of todayPages()) records.push(await shoot(b, baseUrl, out, page));
      if (parts.includes("sheet")) records.push(...(await sheetElements(b, baseUrl, out)));
      if (parts.includes("pages")) for (const page of appPages()) records.push(await shoot(b, baseUrl, out, page));
    },
  );
}
