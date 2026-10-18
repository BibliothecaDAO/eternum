/**
 * The app sheet's captures, one screenshot each at 1920×1080: the app's pages as they are today (the app lab's
 * fixtures, /lab/app/<screen>/<page>), each element of the app sheet (/lab/kit/app, by its `data-sheet-element`), and
 * every desktop direction's page (/lab/kit/app/<direction>/<page>). Run before and after the app moves onto its sheet.
 *
 *   pnpm --dir apps/game prove:app <base-url> <out-dir> [today|sheet|directions]
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

const DIRECTIONS = ["launcher", "ages", "ledger"];
const PAGES = ["play", "lobby", "season", "results"];

/** What holds for a page drawn whole: it did not fall to the error boundary, and it does not scroll sideways. */
const pageChecks = (b) => [
  {
    check: "drawn, not the error boundary",
    ok: b.evaluate(`!document.body.innerText.includes("Something went wrong")`),
  },
  { check: "no horizontal overflow", ok: b.evaluate("document.documentElement.scrollWidth <= innerWidth") },
];

const shoot = async (b, baseUrl, out, { name, path, drawn }) => {
  b.run("open", `${baseUrl}${path}`, "--ignore-https-errors");
  const record = { name, ready: await waitFor(b, drawn, READY_MS), presses: [], checks: [] };
  if (!record.ready) return record;
  await sleep(SETTLE_MS);
  b.run("screenshot", join(out, `${name}.png`));
  record.checks.push(...pageChecks(b));
  return record;
};

const todayPages = () =>
  Object.entries(TODAY).map(([page, path]) => ({
    name: `today-${page}`,
    path: `/lab/app/${path}?capture=1`,
    drawn: `document.querySelector("[data-layout]") !== null`,
  }));

const directionPages = () =>
  DIRECTIONS.flatMap((direction) =>
    PAGES.map((page) => ({
      name: `${direction}-${page}`,
      path: `/lab/kit/app/${direction}/${page}?capture=1`,
      drawn: `document.querySelector('[data-lab="app-direction"]') !== null`,
    })),
  );

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
    b.run("scrollintoview", selector);
    b.run("screenshot", selector, join(out, fileOf(name)));
    return { name: `sheet: ${name}`, ready: true, presses: [], checks: [] };
  });
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const baseUrl = (process.argv[2] ?? "https://127.0.0.1:4176").replace(/\/$/, "");
  const parts = process.argv[4]?.split(",") ?? ["today", "sheet", "directions"];
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
      if (parts.includes("directions"))
        for (const page of directionPages()) records.push(await shoot(b, baseUrl, out, page));
    },
  );
}
