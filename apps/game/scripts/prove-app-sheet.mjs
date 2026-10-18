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
  lobby: "entry-choose/blitz/slot-blitz-1630",
  season: "season-running/season",
  results: "reward-sealed/results/0x5245414c4d53-7",
  "results-opened": "reward-lords/results/0x5245414c4d53-7",
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

const shoot = async (b, baseUrl, out, { name, path, more }) => {
  b.run("open", `${baseUrl}${path}`, "--ignore-https-errors");
  const record = { name, ready: await waitFor(b, DRAWN, READY_MS), presses: [], checks: [] };
  if (!record.ready) return record;
  await sleep(SETTLE_MS);
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
    const bottomOf = (element) => element.getBoundingClientRect().bottom;
    const lowestIn = (element) => Math.max(bottomOf(element), ...[...element.querySelectorAll("*")].map(bottomOf));
    const body = document.querySelector('[data-band="body"]');
    const blocks = body ? [...body.querySelectorAll(":scope > * > *, :scope > *")] : [];
    const bar = document.querySelector('[data-band="bar"]')?.getBoundingClientRect();
    const player = document.querySelector(".app-bar__end > :last-child")?.getBoundingClientRect();
    return {
      spill: Math.round(Math.max(0, ...blocks.map((block) => lowestIn(block) - bottomOf(block)))),
      height: document.documentElement.scrollHeight,
      glyphs: document.querySelectorAll("[data-icon]").length,
      painting: document.querySelector(".app-frame__painting")?.naturalWidth > 0,
      broken: [...document.querySelectorAll("img")]
        .filter((image) => !(image.complete && image.naturalWidth > 0))
        .map((image) => image.currentSrc || image.src),
      goldVerbs: document.querySelectorAll('.app-button[data-kind="primary"], .frontier-primary').length,
      places: document.querySelectorAll('[data-band="bar"] [data-role="tab"]').length,
      playerRightGap: bar && player ? Math.round(bar.right - player.right) : null,
    };
  })()`);
  return [
    { check: "nothing spills out of its block", ok: measure.spill <= 1, measure },
    { check: "every picture loaded", ok: measure.broken.length === 0 },
    { check: "at most one gold verb", ok: measure.goldVerbs <= 1 },
    ...(desktop
      ? [
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
        b.run("set", "viewport", ...PHONE);
        for (const page of sheetPages(false)) records.push(await shoot(b, baseUrl, out, page));
        b.run("set", "viewport", ...VIEWPORT);
      }
    },
  );
}
