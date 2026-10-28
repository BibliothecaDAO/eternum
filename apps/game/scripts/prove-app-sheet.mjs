/**
 * The app sheet's captures: the app's real pages over the app lab's fixtures (/lab/app/<screen>/<page>), each element of
 * the app sheet (/lab/kit/app, by its `data-sheet-element`). The pages the sheet has moved (Play, the Blitz lobby,
 * Season, Results sealed and opened, What's new) are shot at 1920×1080 and on a phone at 390×844, and checked; so are
 * the account's pages (`account`: Connect's steps, You, Settings and what its rows open) and the doorway into a game at
 * each of its holds (`doorway`).
 *
 *   pnpm --dir apps/game prove:app <base-url> <out-dir> [pages|account|doorway|sheet|end-map|qa1] [--state <signed-in.json>]
 *
 * `qa1` presses qa-app-1's findings on the real pages over the fixtures, desktop and phone (QA1_CASES).
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

/** The socials realms.world links, in its order, each with its official mark (src/shell/community.ts). */
const SOCIALS = ["X", "Discord", "Telegram", "CoinGecko", "GitHub"].map(
  (name) => `${name} /tokens/brand-${name.toLowerCase()}.svg`,
);

/**
 * The bars at their limits: on the desktop, the longest name an account takes beside Play's install notice, at the
 * desktop's narrowest width and a laptop's; on a phone, the places and Play's install notice at the narrowest phone the
 * app is held to.
 */
const BAR_CASES = [
  { name: "bar-long-name-1024", path: "long-name", viewport: ["1024", "768"], desktop: true, place: "Play" },
  { name: "bar-long-name-1440", path: "long-name", viewport: ["1440", "900"], desktop: true, place: "Play" },
  // A page whose notice is words alone (a signed-out visitor's Build orders), at the desktop's narrowest width.
  {
    name: "bar-words-notice-1024",
    path: "first-visit/blitz/build-orders",
    viewport: ["1024", "768"],
    desktop: true,
    place: "Play",
  },
  { name: "tabs-phone-360", path: "home/scroll", viewport: ["360", "640"], desktop: false, place: "What's new" },
  { name: "notice-phone-360", path: "home", viewport: ["360", "640"], desktop: false, place: "Play" },
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

/**
 * The account's pages (Connect's steps, You, Settings), each at its fixture state and, where a row opens a step, with
 * that row pressed as a player presses it: shot on the desktop and on a phone, and checked as a page on the app sheet.
 * Connect's steps open in its window over Play, whose place stays lit.
 */
const ACCOUNT_PAGES = {
  you: { path: "home/profile", place: "You" },
  // Signed out, You's place reads Connect, and it is the one lit on You's page.
  "you-signed-out": { path: "first-visit/profile", place: "Connect" },
  "you-unnamed": { path: "unnamed/profile", place: "You" },
  settings: { path: "home/profile/settings", place: "You" },
  "settings-name": { path: "home/profile/settings", place: "You", press: "Name" },
  "settings-portrait": { path: "home/profile/settings", place: "You", press: "Portrait" },
  "settings-wallet-none": { path: "wallet-none/profile/settings", place: "You", press: "Payout wallet" },
  "settings-wallet-linked": { path: "wallet-ready/profile/settings", place: "You", press: "Payout wallet" },
  "settings-sign-out": { path: "home/profile/settings", place: "You", press: "Sign out" },
  "connect-start": { path: "first-visit/connect/start", place: "Play" },
  "connect-code": { path: "first-visit/connect/code", place: "Play" },
  "connect-discord": { path: "first-visit/connect/discord", place: "Play" },
  "connect-name": { path: "first-visit/connect/name", place: "Play" },
  "connect-name-refused": { path: "first-visit/connect/name-refused", place: "Play" },
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
  await act?.(b, record);
  b.run("screenshot", join(out, `${name}.png`));
  record.checks.push(...pageChecks(b), ...(more?.(b) ?? []));
  return record;
};

const DRAWN = `document.querySelector("[data-layout]") !== null`;

/** The doorway into a game at each of its holds (the app lab's fixtures), a full-screen step with no places. */
const DOORWAY_STATES = ["map", "sign-in", "waiting", "preparing", "map-failed", "devices", "watch", "ended"];

const doorwayPages = (desktop) =>
  DOORWAY_STATES.map((state) => ({
    name: `${desktop ? "doorway" : "phone-doorway"}-${state}`,
    path: `/lab/app/home/doorway/${state}?capture=1`,
    more: sheetPageChecks({ desktop, place: null }),
  }));

const accountPages = (desktop) =>
  Object.entries(ACCOUNT_PAGES).map(([page, { path, place, press: words }]) => ({
    name: `${desktop ? "account" : "phone-account"}-${page}`,
    path: `/lab/app/${path}?capture=1`,
    act: words === undefined ? undefined : (b, record) => press(b, record, words),
    more: sheetPageChecks({ desktop, place }),
  }));

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
    // rays) may run past and be cut, and a dialog's scrim covers the page by design; content that is cut is the defect
    // this catches, so it counts whole.
    const rectOf = (element) => element.getBoundingClientRect();
    const spillOf = (block) => {
      const box = rectOf(block);
      const inside = [...block.querySelectorAll("*")]
        .filter((element) => !element.closest('[aria-hidden="true"], .app-scrim'))
        .map(rectOf)
        .filter((rect) => rect.width > 0 && rect.height > 0);
      return Math.max(0, ...inside.map((rect) => Math.max(rect.bottom - box.bottom, rect.right - box.right)));
    };
    const body = document.querySelector('[data-band="body"]');
    const footer = document.querySelector('[data-band="footer"]');
    const blocks = [body, footer].flatMap((band) => (band ? [...band.querySelectorAll(":scope > * > *, :scope > *")] : []));
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
      // The gold verbs the player can press now: a layer over the page (a dialog, Connect) leaves the page under it inert.
      goldVerbs: [...document.querySelectorAll('.app-button[data-kind="primary"], .frontier-primary')].filter((verb) => !verb.closest("[inert]")).length,
      // Each age column's band of painting above its games, as computed.
      ageBands: [...document.querySelectorAll(".app-age-column__body")].map((body) => getComputedStyle(body).paddingTop),
      // A phone's first screen loses what its notice or foot row covers: a verb straddling the top of either is half
      // hidden by it (qa-fresh-2: Play's first Join under the install notice). A list row folding there is a list
      // folding at a screen's edge, as one does at the tab bar, which ends every phone screen.
      cutAtEdge: (() => {
        const bands = ["notice", "foot"].map((name) => document.querySelector('[data-band="' + name + '"]')).filter(Boolean);
        if (!body || bands.length === 0) return [];
        const edge = Math.min(...bands.map((band) => band.getBoundingClientRect().top));
        return [...document.querySelectorAll('[data-band="body"] .app-button')]
          .map((control) => ({ word: control.innerText.trim().slice(0, 30), rect: control.getBoundingClientRect() }))
          .filter(({ rect }) => rect.height > 0 && rect.top < edge - 1 && rect.bottom > edge + 1)
          .map(({ word, rect }) => word + " " + Math.round(rect.top) + "→" + Math.round(rect.bottom) + " at " + Math.round(edge));
      })(),
      // A phone's notice above its tabs is one row: inside its frame it is no taller than its tallest control, so a line
      // wrapping onto rows shows.
      noticeOneRow: (() => {
        const notice = document.querySelector('[data-band="notice"] .app-notice');
        if (!notice) return true;
        const style = getComputedStyle(notice);
        const inner = notice.getBoundingClientRect().height - ["paddingTop", "paddingBottom", "borderTopWidth", "borderBottomWidth"].reduce((sum, side) => sum + parseFloat(style[side]), 0);
        // The row's height is its tallest control's; a line taller than that has wrapped.
        const row = Math.max(0, ...[...notice.querySelectorAll("button")].map((control) => control.getBoundingClientRect().height));
        return row === 0 || inner <= row + 1;
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
      // The footer the page ends on: each social's word and the official mark before it.
      socials: [...document.querySelectorAll('[data-band="footer"] nav[aria-label="Community"] a')].map(
        (link) => link.innerText.trim() + " " + (link.querySelector("img")?.getAttribute("src") ?? "no mark"),
      ),
    };
  })()`);
  return [
    { check: "nothing spills out of its block", ok: measure.spill <= 1, measure },
    { check: "every picture loaded", ok: measure.broken.length === 0 },
    { check: "at most one gold verb", ok: measure.goldVerbs <= 1 },
    {
      check: "a page with the places ends on the footer and its socials' marks; a full-screen step has none",
      ok: JSON.stringify(measure.socials) === JSON.stringify(place === null ? [] : SOCIALS),
      measure: measure.socials,
    },
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
          {
            check: "no verb cut by the phone's notice or foot",
            ok: measure.cutAtEdge.length === 0,
            measure: measure.cutAtEdge,
          },
          // Audit 10-27 (18): the install notice's line wrapped to three rows over Play's Blitz card.
          { check: "the phone's notice is one row", ok: measure.noticeOneRow },
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
      return { text: control.textContent.trim().slice(0, 30), whole: control.scrollWidth <= control.clientWidth + 1, onScreen: rect.left >= 0 && rect.right <= innerWidth && rect.width >= 24, rect };
    });
    // A notice with no verb is its words: they stay drawn whatever the width (review, 10-28: a narrow desktop hid them).
    const unread = [...bar.querySelectorAll(".app-notice")]
      .filter((notice) => !notice.querySelector(".app-button"))
      .filter((notice) => (notice.querySelector(".app-notice__words")?.getBoundingClientRect().width ?? 0) < 24)
      .map((notice) => notice.textContent);
    // Two controls drawn over each other (audit 10-27, 18: Install under the player's name at 1024).
    const overlapping = controls.flatMap((one, index) =>
      controls.slice(index + 1)
        .filter((other) => one.rect.left < other.rect.right - 1 && other.rect.left < one.rect.right - 1 && one.rect.top < other.rect.bottom - 1 && other.rect.top < one.rect.bottom - 1)
        .map((other) => one.text + " over " + other.text),
    );
    return {
      height: Math.round(box.height),
      outside,
      markWidth: Math.round(bar.querySelector('[data-role="lockup"] img')?.getBoundingClientRect().width ?? 0),
      controls,
      overlapping,
      unread,
    };
  })()`);
  return [
    { check: "the bar's contents stay inside it", ok: bar.outside.length === 0, bar },
    { check: "the bar's mark keeps its width", ok: bar.markWidth >= 100 },
    { check: "the bar's controls are whole and on the screen", ok: bar.controls.every((control) => control.onScreen) },
    { check: "no control in the bar over another", ok: bar.overlapping.length === 0, overlapping: bar.overlapping },
    { check: "a notice without verbs shows its words", ok: bar.unread.length === 0, unread: bar.unread },
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

/** Marks the first control whose first line is `words` (a row's name over its value) for the browser's click. */
const markPress = (words, name) => `(() => {
  const control = [...document.querySelectorAll("button, a")].find((candidate) => candidate.innerText.trim().split("\\n")[0].trim() === ${JSON.stringify(words)});
  control?.setAttribute("data-proof-press", ${JSON.stringify(name)});
  return control !== undefined;
})()`;

/** Presses a control by its words as a player does: scrolled to and clicked by the browser. */
const press = async (b, record, words) => {
  const name = words.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  if (!b.evaluate(markPress(words, name))) {
    record.presses.push({ press: words, status: "not on the page" });
    return false;
  }
  const refused = clickAsPlayer(b, `[data-proof-press="${name}"]`);
  record.presses.push({ press: words, status: refused ?? "led" });
  await sleep(600);
  return refused === null;
};

/** Every button on the page, its words: a page's buttons stand in the body, its head's end (desktop) or its foot (phone). */
const buttonsSaid = `[...document.querySelectorAll("[data-band] button")].map((button) => button.innerText.trim())`;

/**
 * qa-app-1's findings, each pressed on the real pages over the app lab's fixtures as a player presses them, at the
 * desktop and on a phone where the finding is a phone's (reports/qa1-app.md).
 */
const QA1_CASES = [
  {
    name: "play-season-players",
    path: "no-realm",
    more: (b) => {
      const chips = b.evaluate(
        `[...document.querySelectorAll(".app-chip")].map((chip) => chip.innerText.trim()).filter((text) => /\\bplayers?\\b/i.test(text))`,
      );
      return [
        {
          check: "a season's players are counted in the right number (qa-app-2 P3-12)",
          ok: chips.length > 0 && chips.every((chip) => /^(1 player|[\d,]+ players)$/.test(chip)),
          chips,
        },
      ];
    },
  },
  {
    name: "share-results",
    path: "reward-sealed/results/0x5245414c4d53-7",
    act: (b, record) => press(b, record, "Share"),
    more: (b) => {
      const seen = b.evaluate(`({
        text: document.body.innerText,
        dialog: document.querySelector('[role="dialog"]') !== null,
        buttons: ${buttonsSaid},
        shown: document.querySelector("output")?.innerText ?? null,
      })`);
      return [
        {
          check: "no old 'Game In Review' walkthrough opens (P2-1)",
          ok: !/game in review/i.test(seen.text) && !seen.dialog,
        },
        {
          check: "Share hands on the page's own line and address: copied, or shown to select (P2-1)",
          ok: seen.buttons.includes("Link copied") || /\/results\/0x5245414c4d53-7$/.test(seen.shown ?? ""),
          seen: { buttons: seen.buttons, shown: seen.shown },
        },
      ];
    },
  },
  {
    name: "whats-new-release",
    path: "home/scroll",
    act: async (b, record) => {
      const oldest = b.evaluate(
        `[...document.querySelectorAll(".app-panel")].find((panel) => panel.querySelector("h2")?.textContent === "Releases")?.querySelectorAll(".app-row__title").length ?? 0`,
      );
      record.releases = oldest;
      b.evaluate(`(() => {
        const rows = [...[...document.querySelectorAll(".app-panel")].find((panel) => panel.querySelector("h2")?.textContent === "Releases").querySelectorAll("button.app-row")];
        rows.at(-1).setAttribute("data-proof-press", "oldest-release");
      })()`);
      const refused = clickAsPlayer(b, '[data-proof-press="oldest-release"]');
      record.presses.push({ press: "the oldest release", status: refused ?? "led" });
      await sleep(800);
    },
    more: (b) => {
      const head = b.evaluate(`(() => {
        const panel = [...document.querySelectorAll(".app-panel")].find((each) => each.querySelector("h2")?.textContent === "Patch notes");
        const box = panel.getBoundingClientRect();
        return { top: Math.round(box.top), bottom: Math.round(box.bottom), height: innerHeight, focused: document.activeElement?.contains(panel) ?? false };
      })()`);
      return [
        { check: "the picked release's notes are in view (P3-1)", ok: head.top >= 0 && head.top < head.height, head },
        { check: "and hold the focus (P3-1)", ok: head.focused },
      ];
    },
  },
  {
    name: "terms-no-place",
    path: "home/terms",
    more: (b) => [
      {
        check: "no place is current on a legal page (P3-3)",
        ok: b.evaluate(`document.querySelectorAll('[data-role="tab"][aria-current="page"]').length === 0`),
      },
    ],
  },
  {
    name: "season-chips",
    path: "season-running/season",
    more: (b) => {
      const chips = b.evaluate(
        `[...document.querySelectorAll(".app-row .app-chip")].slice(0, 2).map((chip) => [chip.innerText.trim(), chip.title, chip.textContent])`,
      );
      return [
        {
          check: "a board row's counts say what they count, on hover and when read (P3-7)",
          ok:
            chips.length === 2 &&
            chips[0][1] === "sites cleared" &&
            chips[1][1] === "LORDS" &&
            /sites cleared$/.test(chips[0][2]),
          chips,
        },
      ];
    },
  },
  {
    name: "settings-name",
    path: "home/profile/settings",
    act: (b, record) => press(b, record, "Name"),
    more: (b) => {
      const claim = b.evaluate(
        `[...document.querySelectorAll("button")].find((button) => button.innerText.trim() === "Claim name")?.disabled ?? null`,
      );
      return [{ check: "Claim name is off for the name already held (P3-6)", ok: claim === true, claim }];
    },
  },
  {
    name: "you-no-games",
    path: "no-games/profile",
    // The desktop's: its right half holds the games; a phone lists them under the card, and none yet shows nothing.
    desktopOnly: true,
    more: (b) => [
      {
        check: "with no finished game, the right half says where they will show (P3-9)",
        ok: b.evaluate(`document.body.innerText.includes("Your finished games will show here.")`),
      },
    ],
  },
  {
    name: "you-unnamed",
    path: "unnamed/profile",
    more: (b) => {
      const buttons = b.evaluate(buttonsSaid);
      return [
        {
          check: "a session with no name has Sign out (qa-blitz-1 #3)",
          ok: buttons.includes("Sign out") && buttons.includes("Claim name"),
          buttons,
        },
      ];
    },
  },
  {
    name: "settings-unnamed",
    path: "unnamed/profile/settings",
    more: (b) => {
      const buttons = b.evaluate(buttonsSaid);
      return [
        {
          check: "and in Settings too (qa-blitz-1 #3)",
          ok: buttons.includes("Sign out") && buttons.includes("Claim name"),
          buttons,
        },
      ];
    },
  },
];

/** The phone's: the card says what the desktop's says, and a board's row is one line. */
const QA1_PHONE_CASES = [
  {
    name: "phone-you",
    path: "home/profile",
    more: (b) => [
      {
        check: "the phone's own card says how a rating is carried (P3-10)",
        ok: b.evaluate(`document.body.innerText.includes("Link a wallet in Settings to carry a rating.")`),
      },
      {
        check: "the card opens on the player's name, never a stand-in (P3-4)",
        ok: b.evaluate(`!/\\bLord [0-9a-f]{4}\\b/.test(document.querySelector('[data-band="body"]').innerText)`),
      },
    ],
  },
  {
    name: "phone-results-rows",
    path: "reward-sealed/results/0x5245414c4d53-7",
    more: (b) => {
      const rows = b.evaluate(`(() => {
        const panel = [...document.querySelectorAll(".app-panel")].find((each) => each.querySelector("h2")?.textContent === "The game");
        return [...panel.querySelectorAll(".app-row")].map((row) => {
          const words = row.querySelector(".app-row__words").getBoundingClientRect();
          const trail = row.querySelector(".app-row__trail").getBoundingClientRect();
          return { text: row.innerText.replace(/\\s+/g, " "), oneLine: trail.top < words.bottom };
        });
      })()`);
      return [
        {
          check: "each board row's points stay on its line (P3-11)",
          ok: rows.length > 0 && rows.every((row) => row.oneLine),
          rows,
        },
      ];
    },
  },
];

const qa1 = (cases) =>
  cases.map(({ name, path, act, more }) => ({ name: `qa1-${name}`, path: `/lab/app/${path}?capture=1`, act, more }));

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const baseUrl = (process.argv[2] ?? "https://127.0.0.1:4176").replace(/\/$/, "");
  const parts = process.argv[4]?.split(",") ?? ["pages", "account", "doorway", "sheet"];
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
      if (parts.includes("doorway")) {
        for (const page of doorwayPages(true)) records.push(await shoot(b, baseUrl, out, page));
        b.run("set", "viewport", ...PHONE);
        for (const page of doorwayPages(false)) records.push(await shoot(b, baseUrl, out, page));
        b.run("set", "viewport", ...VIEWPORT);
      }
      if (parts.includes("account")) {
        for (const page of accountPages(true)) records.push(await shoot(b, baseUrl, out, page));
        b.run("set", "viewport", ...PHONE);
        for (const page of accountPages(false)) records.push(await shoot(b, baseUrl, out, page));
        b.run("set", "viewport", ...VIEWPORT);
      }
      if (parts.includes("sheet")) records.push(...(await sheetElements(b, baseUrl, out)));
      if (parts.includes("end-map")) records.push(await proveEndMap(b, baseUrl, out, state));
      if (parts.includes("qa1")) {
        for (const page of qa1(QA1_CASES)) records.push(await shoot(b, baseUrl, out, page));
        b.run("set", "viewport", ...PHONE);
        for (const page of qa1([...QA1_CASES.filter((qa) => !qa.desktopOnly), ...QA1_PHONE_CASES]))
          records.push(await shoot(b, baseUrl, out, { ...page, name: `${page.name}-phone` }));
        b.run("set", "viewport", ...VIEWPORT);
      }
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
