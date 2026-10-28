#!/usr/bin/env node
/**
 * The HUD sheet migration's before-and-after: every HUD surface the lab draws, shot at 1920×1080 (the desktop HUD's
 * stage also at 1024×768, 1280×720 and 1440×900), one picture per surface and size. Against a running dev build (`pnpm --dir apps/game dev --host 127.0.0.1 --port <port>`):
 *
 *   pnpm --dir apps/game capture:hud-lab --base-url https://127.0.0.1:<port> --out <dir> [--only <surface>,...]
 *
 * A size under a desktop's (1024) is shot with a phone's touch, so its finger-size rules draw (touchAtPhoneWidth).
 *
 * Run it on the commit before a change and again after; the two directories hold the same file names. A surface the
 * page does not draw (its `[data-lab]` mark missing) fails the run, so a broken surface never passes as a picture. The
 * desktop HUD's stage is also held to its bottom-left rule at each size (scripts/hud-sheet/clearance.mjs): the minimap in
 * the left column's corner, the foot between the columns.
 *
 * With `--hud-layout`, it holds the in-game HUD's desktop layout instead: each of HUD_LAYOUT_PAGES at each of the
 * DESKTOPS sizes, read and judged as the playtest's `hud-layout` step judges a live map (judgeHudLayout: every part
 * drawn whole on the page, none over another, every control reachable, at most seven parts a region), writing a picture
 * each and `hud-layout.json`, and failing the run on any fault.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";

import { hudClearanceProblems, READ_HUD_BOXES } from "../../../scripts/hud-sheet/clearance.mjs";

import { openPageDevTools, touchAtPhoneWidth } from "./client-playtest/browser-session.mjs";
import { HUD_LAYOUT_EXPRESSION, judgeHudLayout } from "./client-playtest/hud-layout.mjs";
import { runAgentBrowser } from "./run-renderer-scene-smoke.mjs";

const VIEWPORT = [1920, 1080];
/** The desktop sizes the HUD's layout is held at: the narrowest desktop, a small laptop, a laptop, a full HD screen. */
const DESKTOPS = [[1024, 768], [1280, 720], [1440, 900], VIEWPORT];
const SETTLE_MS = "1200";
/** Two phones: a common one and the owner's Galaxy S22+, the narrowest the HUD is held at. */
const PHONES = [
  [390, 844],
  [384, 832],
];
/** A Frontier card or page as a laptop and the phones show it. */
const CARDS = [[1440, 900], ...PHONES];

/** The Armies list or dock: how many entries it holds (armies and open slots), and each stamina bar's start, top and width. */
const READ_ARMY_BARS = `(() => {
  const nav = document.querySelector('nav[aria-label="Armies"]');
  const bars = nav ? [...nav.querySelectorAll('[role="meter"][aria-label="stamina"]')] : [];
  return {
    entries: nav ? nav.children.length : 0,
    bars: bars.map((bar) => {
      const box = bar.getBoundingClientRect();
      return { left: box.left, top: box.top, width: box.width };
    }),
  };
})()`;

/**
 * Every army and open slot carries a stamina bar, and the bars line up whatever each entry's words say (owner, 27
 * October): one width, and one left edge down a list (or one top along a phone's row of tokens).
 */
const armyBarsProblems = ({ entries, bars }) => {
  if (bars.length < 2 || bars.length !== entries) return [`${bars.length} stamina bars on ${entries} armies and slots`];
  const same = (key) => bars.every((bar) => Math.abs(bar[key] - bars[0][key]) <= 0.5);
  const problems = [];
  if (!same("width")) problems.push(`stamina bars' widths differ: ${bars.map(({ width }) => width.toFixed(1))}`);
  if (!same("left") && !same("top")) problems.push(`stamina bars start at ${bars.map(({ left }) => left.toFixed(1))}`);
  return problems;
};

/** The open sheet: how far its body scrolls, and where its verb stands against the page's height. */
const READ_SHEET_FIT = `(() => {
  const sheet = document.querySelector("[data-kit-sheet]");
  if (!sheet) return { sheet: false };
  const body = sheet.querySelector(".ui-sheet__body");
  const verb = sheet.querySelector(".ui-window__foot > button:last-of-type")?.getBoundingClientRect();
  return { sheet: true, scrolls: body.scrollHeight - body.clientHeight, verb: verb && { top: verb.top, bottom: verb.bottom }, height: innerHeight };
})()`;

/** A card fits the screen whole (owner, 27 October: "it doesnt fit on my s22+ screen"): no scroll, its verb in view. */
const sheetFitProblems = ({ sheet, scrolls, verb, height }) => {
  if (!sheet) return ["no sheet open"];
  const problems = [];
  if (scrolls > 1) problems.push(`the sheet's body scrolls ${scrolls}px`);
  if (verb && (verb.top < 0 || verb.bottom > height)) problems.push(`its verb stands at ${verb.top}-${verb.bottom}`);
  return problems;
};
const FITS = { read: READ_SHEET_FIT, rule: sheetFitProblems };

/** Each side of the fight on the open card: its box, and the widest any of its words, its mark or its bar reaches. */
const READ_FIGHT_SIDES = `(() => [...document.querySelectorAll('[role="img"][aria-label*="→"]')].map((side) => {
  const box = side.getBoundingClientRect();
  // The text itself, not its spans: a span held to its box lets wider words run past it unseen.
  const walker = document.createTreeWalker(side, NodeFilter.SHOW_TEXT);
  const parts = [...side.querySelectorAll("img, svg, .rounded-full")].map((part) => part.getBoundingClientRect());
  for (let text = walker.nextNode(); text; text = walker.nextNode()) {
    const range = document.createRange();
    range.selectNodeContents(text);
    parts.push(range.getBoundingClientRect());
  }
  return {
    label: side.getAttribute("aria-label"),
    left: box.left,
    right: box.right,
    reach: { left: Math.min(...parts.map(({ left }) => left)), right: Math.max(...parts.map(({ right }) => right)) },
    page: innerWidth,
  };
}))()`;

/** Both sides of a fight fit, whatever their numbers (owner, 27 October: "the army & enemy numbers must both fit"). */
const fightSidesProblems = (sides) => {
  if (sides.length !== 2) return [`${sides.length} fight sides drawn, not 2`];
  const problems = [];
  for (const side of sides) {
    if (side.left < 0 || side.right > side.page)
      problems.push(`${side.label} runs off the page (${side.left}-${side.right})`);
    if (side.reach.left < side.left - 0.5 || side.reach.right > side.right + 0.5)
      problems.push(`${side.label}'s figures run out of its box (${side.reach.left}-${side.reach.right})`);
  }
  const [first, second] = sides.toSorted((a, b) => a.left - b.left);
  if (first.right > second.left + 0.5) problems.push(`the two sides overlap (${first.right} past ${second.left})`);
  return problems;
};
/** The narrowest phone held (360), a common one and the widest, and a laptop. */
const FIGHT_SIZES = [[360, 800], ...PHONES, [430, 932], [1440, 900]];
const FIGHT_FITS = { sizes: FIGHT_SIZES, read: READ_FIGHT_SIDES, rule: fightSidesProblems };
/** The build sheet's narrowest phone, a common one, the widest, and a laptop: three cards to a row at every size. */
const BUILD_SIZES = [
  [360, 780],
  [390, 844],
  [430, 932],
  [1440, 900],
];

/** Each build card: its name, its gems, and every part of its foot drawn past the card's edge or cut by its own box. */
const READ_BUILD_CARDS = `(() => [...document.querySelectorAll(".ui-card")].map((card) => {
  const box = card.getBoundingClientRect();
  const clipped = [...card.querySelectorAll(".ui-card__foot *")].filter((part) => {
    const at = part.getBoundingClientRect();
    if (at.width === 0) return false;
    const past = at.left < box.left + 1 || at.right > box.right - 1 || at.top < box.top || at.bottom > box.bottom;
    return past || (part.clientWidth > 0 && part.scrollWidth > part.clientWidth + 1);
  });
  return {
    name: card.querySelector(".ui-card__title")?.textContent ?? "",
    gems: card.querySelectorAll(".ui-tier").length,
    sides: [...card.querySelectorAll("[data-side]")].map((side) => side.getAttribute("data-side") + " " + (side.querySelector(".ui-tier")?.textContent ?? "no gem")),
    clipped: [...new Set(clipped.map((part) => part.textContent))],
  };
}))()`;

/**
 * A build card reads whole at every size (owner, 27 October: its words clipped at the card's edge on a phone), and
 * says its research with gems, never words for it ("why no gems instead of the text ?"): a gem on each side of a row
 * that has two (Farm, Workshop, Barracks), else its type's one gem.
 */
const SIDED = new Set(["Farm", "Workshop", "Barracks"]);
const buildCardProblems = (cards) => {
  if (cards.length === 0) return ["no build card drawn"];
  return cards.flatMap(({ name, gems, sides, clipped }) => [
    ...(SIDED.has(name)
      ? sides.length === 2 && gems === 2 && sides.every((side) => !side.endsWith("no gem"))
        ? []
        : [`${name} shows ${sides.join(", ") || "no side"} (${gems} gems), not a gem per side`]
      : gems === 1 && sides.length === 0
        ? []
        : [`${name} shows ${gems} gems`]),
    ...clipped.map((part) => `${name}: "${part}" is clipped`),
  ]);
};

/**
 * Each surface: the lab page that draws it, the mark the page puts on it, its sizes when not just 1920×1080, what it
 * waits for once open (`waitFor`, a selector) when it draws late, and what the run holds it to: a `read` of the page
 * judged by its `rule`, each fault failing the run.
 */
export const SURFACES = [
  {
    name: "blitz-hud",
    path: "/lab/kit/panels?part=hud",
    mark: "hud",
    sizes: DESKTOPS,
    read: READ_HUD_BOXES,
    rule: hudClearanceProblems,
  },
  { name: "blitz-left-column", path: "/lab/kit/panels", mark: "left-column" },
  { name: "blitz-top-header", path: "/lab/kit/panels?part=top-header", mark: "top-header" },
  { name: "blitz-tile-army", path: "/lab/kit/panels?tile=army", mark: "tile" },
  { name: "blitz-tile-empty", path: "/lab/kit/panels?tile=empty", mark: "tile" },
  { name: "blitz-realm-castle", path: "/lab/kit/panels?tile=castle", mark: "tile" },
  { name: "blitz-realm-building", path: "/lab/kit/panels?tile=building", mark: "tile" },
  { name: "blitz-realm-production", path: "/lab/kit/panels?tile=production", mark: "tile" },
  { name: "blitz-next-up-and-events", path: "/lab/kit/guidance", mark: "next-up" },
  { name: "frontier-hud", path: "/lab/kit/hud/idle", mark: "frontier" },
  {
    name: "frontier-armies",
    path: "/lab/kit/hud/armies-open",
    mark: "frontier",
    sizes: CARDS,
    read: READ_ARMY_BARS,
    rule: armyBarsProblems,
  },
  // Transfer troops: 500 into 1,500, both total XP values, loss confirmation and a partial transfer.
  { name: "frontier-merge", path: "/lab/kit/hud/merge", mark: "frontier-merge", sizes: [VIEWPORT, [390, 844]] },
  { name: "frontier-selected", path: "/lab/kit/hud/selected", mark: "frontier" },
  { name: "frontier-menu", path: "/lab/kit/hud/menu", mark: "frontier" },
  { name: "frontier-explore", path: "/lab/kit/hud/explore", mark: "frontier" },
  { name: "frontier-stores", path: "/lab/kit/hud/stores", mark: "frontier" },
  { name: "frontier-site-camp", path: "/lab/kit/hud/site-camp", mark: "frontier" },
  { name: "frontier-army-refill", path: "/lab/kit/hud/army-refill", mark: "frontier" },
  ...[
    "castle",
    "castle-short",
    "building-farm",
    "building-workshop-short",
    "building-barracks",
    "building-war-hall",
    "building-scouts-lodge",
  ].map((state) => ({
    name: `frontier-${state}`,
    path: `/lab/kit/hud/${state}`,
    mark: "frontier",
    sizes: CARDS,
    ...FITS,
  })),
  { name: "frontier-research", path: "/lab/kit/hud/research", mark: "frontier", sizes: CARDS },
  ...["build", "build-early"].map((state) => ({
    name: `frontier-${state}`,
    path: `/lab/kit/hud/${state}`,
    mark: "frontier",
    sizes: BUILD_SIZES,
    read: READ_BUILD_CARDS,
    rule: buildCardProblems,
  })),
  { name: "frontier-army", path: "/lab/kit/hud/selected", mark: "frontier", sizes: CARDS },
  { name: "frontier-season", path: "/lab/kit/hud/season", mark: "frontier", sizes: CARDS },
  { name: "frontier-site-armyless", path: "/lab/kit/hud/site-armyless", mark: "frontier", sizes: CARDS },
  { name: "frontier-site-ruin", path: "/lab/kit/hud/site-ruin", mark: "frontier", ...FIGHT_FITS },
  // The owner's phone card (10-27) and seven-digit armies, on the attack's card.
  { name: "frontier-site-runereach", path: "/lab/kit/hud/site-runereach", mark: "frontier", ...FIGHT_FITS },
  { name: "frontier-site-large", path: "/lab/kit/hud/site-large", mark: "frontier", ...FIGHT_FITS },
  // Every state of the attack's card draws the same two sides (owner, 10-27): out of reach (the owner's Shadeglow camp,
  // and with a Move toward it), short of stamina, and refused; and Blitz's attack preview.
  { name: "frontier-site-shadeglow", path: "/lab/kit/hud/site-shadeglow", mark: "frontier", ...FIGHT_FITS },
  { name: "frontier-site-far", path: "/lab/kit/hud/site-far", mark: "frontier", ...FIGHT_FITS },
  { name: "frontier-site-short", path: "/lab/kit/hud/site-short", mark: "frontier", ...FIGHT_FITS },
  { name: "frontier-site-refused", path: "/lab/kit/hud/site-refused", mark: "frontier", ...FIGHT_FITS },
  {
    name: "blitz-attack-preview-short",
    path: "/lab/kit/unified/blitz-attack-short",
    mark: "unified",
    waitFor: '[role="img"][aria-label*="→"]',
    ...FIGHT_FITS,
  },
  {
    name: "blitz-attack-preview",
    path: "/lab/kit/unified/blitz-attack",
    mark: "unified",
    waitFor: '[role="img"][aria-label*="→"]',
    ...FIGHT_FITS,
  },
  // Twelve-digit sides whose short figures would read alike: exact, set smaller to fit, on the attack card.
  { name: "frontier-site-alike", path: "/lab/kit/hud/site-alike", mark: "frontier", ...FIGHT_FITS },
  { name: "frontier-day-done", path: "/lab/kit/hud/day-done-full", mark: "frontier", sizes: CARDS },
  { name: "frontier-clear-ruin", path: "/lab/kit/hud/clear-ruin", mark: "frontier", sizes: CARDS },
];

/**
 * The lab pages the layout is held on: the one desktop HUD as each mode and viewer meets it (a Blitz player with the
 * Build order panel in the rail, the same as the game begins with news over it, a Blitz spectator while the game runs and once it has finished, a Frontier player), then Frontier's own moments on it (an
 * army picked, a camp's card, Deploy, Research, Next up on the deploy, the purse with Next up, the owner's
 * Kingdom with labor to claim, the last hour, a sheet).
 */
const HUD_LAYOUT_PAGES = [
  "unified/blitz",
  "unified/blitz-start",
  "unified/blitz-spectator",
  "unified/blitz-finished",
  "unified/frontier",
  "hud/selected",
  "hud/site-camp",
  "hud/deploy",
  "hud/research",
  "hud/next-up-deploy",
  "hud/purse-next-up",
  "hud/realm-claim",
  "hud/last-hour",
  "hud/stores",
];

const holdHudLayout = ({ baseUrl, out, run }) => {
  const results = [];
  for (const [width, height] of DESKTOPS) {
    run("set", "viewport", String(width), String(height));
    for (const page of HUD_LAYOUT_PAGES) {
      run("open", `${baseUrl}/lab/kit/${page}`, "--ignore-https-errors");
      // The HUD mounts once the lab's game has opened its shard: wait for its column, then let the parts settle.
      run("wait", "[data-hud-column]");
      run("wait", HUD_SETTLE_MS);
      const verdict = judgeHudLayout(JSON.parse(JSON.parse(run("eval", HUD_LAYOUT_EXPRESSION))));
      run("screenshot", join(out, `hud-layout-${width}x${height}-${page.replace("/", "-")}.png`));
      results.push({ size: `${width}x${height}`, page, ...verdict });
      console.log(`${verdict.status} ${width}x${height} ${page}${verdict.reason ? `: ${verdict.reason}` : ""}`);
    }
  }
  writeFileSync(join(out, "hud-layout.json"), JSON.stringify(results, null, 2));
  return results.filter(({ status }) => status !== "completed");
};

/** How long the HUD's parts take to settle once its column is drawn (panels that size to what they read). */
const HUD_SETTLE_MS = "1500";

const main = async () => {
  const { values } = parseArgs({
    options: {
      "base-url": { type: "string" },
      out: { type: "string" },
      only: { type: "string" },
      "hud-layout": { type: "boolean" },
    },
  });
  if (!values["base-url"] || !values.out) throw new Error("Usage: --base-url <url> --out <dir> [--only a,b]");
  const only = values.only?.split(",");
  const surfaces = only ? SURFACES.filter(({ name }) => only.includes(name)) : SURFACES;
  mkdirSync(values.out, { recursive: true });
  const session = `hud-lab-${process.pid}`;
  const run = (...args) => runAgentBrowser(session, args);
  if (values["hud-layout"]) {
    let faults;
    try {
      faults = holdHudLayout({ baseUrl: values["base-url"], out: values.out, run });
    } finally {
      run("close");
    }
    if (faults.length > 0) {
      console.error(`HUD layout faults: ${faults.length}`);
      process.exit(1);
    }
    return;
  }
  const missing = [];
  const broken = [];
  const interactions = [];
  let devTools = null;
  try {
    // A phone's size is shot with a phone's touch (its finger-size rules), over a DevTools connection held open.
    run("open", "about:blank");
    devTools = await openPageDevTools({ run: (args) => run(...args) });
    for (const { name, path, mark, sizes = [VIEWPORT], read, rule, waitFor } of surfaces) {
      for (const [width, height] of sizes) {
        const shot = sizes.length > 1 ? `${name}-${width}x${height}` : name;
        run("set", "viewport", String(width), String(height));
        await touchAtPhoneWidth(devTools, width);
        run("open", `${values["base-url"]}${path}`, "--ignore-https-errors");
        run("wait", SETTLE_MS);
        if (waitFor) run("wait", waitFor);
        if (name === "frontier-merge") run("wait", '[role="dialog"][aria-label="Transfer troops"]');
        const drawn = JSON.parse(run("eval", `Boolean(document.querySelector('[data-lab="${mark}"]'))`));
        if (!drawn) missing.push(shot);
        run("screenshot", join(values.out, `${shot}.png`));
        if (name === "frontier-merge") {
          // Army 1 has 22 unspent XP and two upgrades; Army 3 has 20 unspent XP and one upgrade.
          const confirmLabel = "Lose 222 XP, merge into Army 3";
          run("find", "role", "button", "click", "--name", "Merge into Army 3", "--exact");
          run("wait", "--text", confirmLabel);

          // Read the visible totals, loss message, confirmation reachability and the amount in both controls.
          const readSheet = () =>
            JSON.parse(
              run(
                "eval",
                `(() => {
            const sheet = document.querySelector('[role="dialog"]');
            const button = [...sheet.querySelectorAll('button')].find(b => b.textContent === ${JSON.stringify(confirmLabel)});
            const visible = element => {
              const box = element?.getBoundingClientRect();
              return !!box && box.left >= 0 && box.right <= innerWidth && box.top >= 0 && box.bottom <= innerHeight;
            };
            return { text: sheet.textContent, totals: [...sheet.querySelectorAll('[role="group"][aria-label$="total XP"]')].map(group => group.textContent), struck: sheet.querySelector('s')?.textContent ?? null, reachable: visible(button), notice: sheet.querySelector('.ui-notice')?.textContent ?? null, typed: sheet.querySelector('input[aria-label^="Troops "]').value, slid: sheet.querySelector('input[type="range"]').value };
          })()`,
              ),
            );
          const confirmed = readSheet();
          writeFileSync(join(values.out, `${shot}-confirmation.json`), JSON.stringify(confirmed, null, 2));
          if (
            !confirmed.reachable ||
            confirmed.notice !== "Army 1 loses its XP and upgrades." ||
            confirmed.struck !== null ||
            JSON.stringify(confirmed.totals) !== JSON.stringify(["Total XP222→0", "Total XP120→120"])
          ) {
            throw new Error(`${shot}: both total XP values and their outcomes must agree with the loss confirmation`);
          }
          // It opens at all Army 1 holds: the box and the slider both say 500, what the merge sends.
          if (confirmed.typed !== "500" || confirmed.slid !== "500") {
            throw new Error(`${shot}: the amount opens at the 500 Army 1 sends, in the box and on the slider`);
          }
          run("screenshot", join(values.out, `${shot}-confirm.png`));
          // The slider moved one step, by key: Army 1 sends one fewer and keeps one troop, so the merge becomes a move.
          run("focus", 'input[type="range"]');
          run("press", "ArrowLeft");
          run("wait", "--text", "Move 499 to Army 3");
          const partial = readSheet();
          if (
            partial.text.includes(confirmLabel) ||
            partial.struck !== null ||
            partial.notice !== null ||
            JSON.stringify(partial.totals) !== JSON.stringify(["Total XP222→222", "Total XP120→120"])
          ) {
            throw new Error(`${shot}: changing the amount must clear confirmation and the merge's losses`);
          }
          if (partial.typed !== "499" || partial.slid !== "499") {
            throw new Error(`${shot}: the box and the slider hold the 499 the button sends`);
          }
          run("screenshot", join(values.out, `${shot}-partial.png`));
          interactions.push({ shot, confirmed, partial });
          writeFileSync(join(values.out, "merge-interactions.json"), JSON.stringify(interactions, null, 2));
        }
        const problems = rule ? rule(JSON.parse(run("eval", read))) : [];
        problems.forEach((problem) => broken.push(`${shot}: ${problem}`));
        console.log(`${!drawn ? "MISSING" : problems.length > 0 ? "BROKEN" : "shot"} ${shot}`);
      }
    }
  } finally {
    devTools?.close();
    run("close");
  }
  if (missing.length > 0) console.error(`Not drawn: ${missing.join(", ")}`);
  broken.forEach((line) => console.error(line));
  if (missing.length > 0 || broken.length > 0) process.exit(1);
};

await main();
