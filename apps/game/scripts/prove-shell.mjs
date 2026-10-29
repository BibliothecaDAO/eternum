#!/usr/bin/env node
/**
 * The shell's proof: the places' flows pressed on the real client the way a player presses them, from a fresh Play,
 * with every press and the page it led to kept. Against a running dev build
 * (`pnpm --dir apps/game dev --host 127.0.0.1 --port <port>`):
 *
 *   pnpm --dir apps/game prove:shell --base-url https://127.0.0.1:<port> --out <dir> [--state <signed-in.json>]
 *     [--watch /g/<chain>/<game>]
 *
 * Without `--state` it is a new visitor, and the run also opens the app lab's fixture pages (below); with a saved
 * signed-in browser state (agent-browser's `state save`, which keeps the device key with the session) a returning
 * player. Each flow runs at desktop (1440×900) and phone (390×844). Each press is made by the browser, scrolled to and
 * clicked, so a control the pointer cannot reach fails (prove-run.mjs, the proofs' one meaning of a pass).
 *
 * It changes nothing it does not put back and spends nothing: it stops at a lobby (paying is the player's), records
 * How to play's link without leaving (it opens the docs site in a new tab), opens Sign out's question and leaves it
 * unanswered, and sets the alert level and the music switch back to the values it read before pressing them, however
 * the flow ends, reading them again after a reload.
 *
 * Writes <out>/run-<start>/shell-proof-<new-visitor|returning>.json and a screenshot of each flow's end. A flow's
 * record holds each press (what was pressed, the address it led to, and its status), the setting it put back, and each
 * page passed through: its address, its controls (all, and in view by a centre hit test, the navigation's apart), its
 * gold buttons, its smallest text, and whether it fits one screen. A flow's last press leads only when the flow's end
 * is reached; a flow stopped by a service that did not answer, or by a row the live data does not hold, is
 * unavailable, any other stop failed, and the command exits 1 unless every flow led.
 *
 * With `--watch` and a signed-in state that holds realms in that live game, the run is the spectator's way back to
 * play instead, at both sizes: watch the game, open the identity chip, press its Play, and hold the boot to what a
 * player gets. The doorway shows and then goes, the boot ends ready on the game's own scene with no spectate, the
 * chip names the player, and the page is never reloaded (writes shell-proof-watch-to-play.json).
 */
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { clickAsPlayer, pathOf, runProof, sleep, waitFor } from "./prove-run.mjs";

const VIEWPORTS = { desktop: [1440, 900], phone: [390, 844] };
const SETTLE_MS = 1500;
const READY_TIMEOUT_MS = 20_000;
const END_TIMEOUT_MS = 10_000;

const READY = `document.documentElement.dataset.bootState === "app-ready" && document.querySelector("[data-layout]")`;

/**
 * A press, by what a player sees: a place in the navigation, a row or button by its words, a switch view, a setting's
 * switch, the first board row, a finished game, or a link read without following it (it leaves the app). A board's
 * first row and a finished game are the live data's: their absence makes a flow unavailable, not failed.
 */
const tab = (word) => ({ kind: "tab", word });
const press = (word) => ({ kind: "press", word });
const view = (word) => ({ kind: "view", word });
const toggle = (word) => ({ kind: "toggle", word });
const firstRow = () => ({ kind: "first-row", live: true });
const finishedGame = () => ({ kind: "finished-game", live: true });
const link = (word) => ({ kind: "link", word });
/** Play's Join, on a Blitz slot the live data may not hold. */
const joinSlot = () => ({ kind: "press", word: "Join", live: true });

/** A Season board's panel, named by its title, holds `rows` or its empty line. */
const boardShown = (title, rows) =>
  `[...document.querySelectorAll('[data-band="body"] .app-panel')].some((panel) => panel.querySelector("h2")?.innerText.trim() === ${JSON.stringify(title)} && (${rows} || panel.querySelector(".app-empty")))`;

/** The place lit as the page's own, by its word, in the bar or the phone's tabs. */
const placeLit = (word) =>
  `[...document.querySelectorAll('[data-role="tab"][aria-current="page"]')].some((tab) => tab.innerText.trim() === ${JSON.stringify(word)})`;

/** The Connect window, open (shell/sign-in/connect-window.tsx). */
const CONNECT_OPEN = `document.querySelector('[role="dialog"][aria-label="Connect"]') !== null`;

/** Each flow's end, checked in the page. */
const END = {
  // A board is shown when its panel holds its first place, or says it has no one on it yet.
  frontierBoard: `location.pathname === "/season" && ${boardShown("Frontier", `[...panel.querySelectorAll(".app-row .app-rank")].some((rank) => rank.innerText.trim() === "1")`)}`,
  blitzBoard: `location.pathname === "/season" && ${boardShown("Blitz", `panel.querySelector("ol li")`)}`,
  player: `location.pathname.startsWith("/p/") && document.querySelector('[data-role="back"]')`,
  results: `location.pathname.startsWith("/results/") && document.querySelector('[data-role="back"]')`,
  important: `document.querySelector('[role="radio"][aria-checked="true"]')?.innerText.trim() === "Important"`,
  musicOn: `document.querySelector('[role="switch"][aria-label="Music"]')?.getAttribute("aria-checked") === "true"`,
  signOutAsked: `[...document.querySelectorAll("[data-kit-sheet]")].some((sheet) => sheet.innerText.includes("Sign out?"))`,
  docs: `[...document.querySelectorAll("a[href]")].some((a) => a.href.startsWith("https://docs.realms.party") && a.target === "_blank")`,
  // Realms' marketplace, You's row (the footer's, signed out), which opens its own site in a new tab.
  market: `[...document.querySelectorAll("a[href]")].some((a) => a.href === "https://realms.market/" && a.target === "_blank")`,
  // What's new, read from You (lit there; Connect, signed out), a section's tab chosen and its changes under its name.
  news: `location.pathname === "/scroll" && (${placeLit("You")} || ${placeLit("Connect")}) && [...document.querySelectorAll('[role="tab"][aria-selected="true"]')].some((tab) => tab.innerText.trim() === "Blitz") && [...document.querySelectorAll(".app-panel h2")].some((name) => name.innerText.trim() === "Blitz")`,
  // The terms, read from the footer: a page no place holds, so none is lit (qa-app-1 P3-3).
  terms: `location.pathname === "/terms" && document.querySelectorAll('[data-role="tab"][aria-current="page"]').length === 0`,
  // Connect, open over the page it was asked from: Play from the bar, the lobby from its Sign in.
  connect: `location.pathname === "/" && ${CONNECT_OPEN}`,
  lobby: `location.pathname.startsWith("/blitz/") && document.querySelector('[data-band="body"]')`,
  lobbyConnect: `location.pathname.startsWith("/blitz/") && ${CONNECT_OPEN}`,
};

/** Season's rating board, as it says its service did not answer (ui/design-system/kit/service-failure.tsx). */
const RATINGS_DOWN = "Ratings did not answer.";

/** The flows, as the shell viewer's direction Q draws them; Blitz's board is a switch away on a phone. */
const flows = (layout, persona) => {
  const blitz = layout === "phone" ? [tab("Season"), view("Blitz")] : [tab("Season")];
  const shared = {
    standing: { steps: [tab("Season")], end: END.frontierBoard },
    blitzboard: { steps: blitz, end: END.blitzBoard, outage: RATINGS_DOWN },
    rival: { steps: [tab("Season"), firstRow()], end: END.player },
    terms: { steps: [link("Terms of Service")], end: END.terms },
  };
  if (persona === "new-visitor")
    return {
      ...shared,
      // Signed out, You is Connect, and You's rows are the footer's.
      guide: { steps: [link("How to play")], end: END.docs },
      market: { steps: [link("Market")], end: END.market },
      news: { steps: [link("What's new"), view("Blitz")], end: END.news },
      signin: { steps: [tab("Connect")], end: END.connect },
      join: { steps: [joinSlot(), press("Sign in")], end: END.lobbyConnect },
    };
  return {
    ...shared,
    guide: { steps: [tab("You"), link("How to play")], end: END.docs },
    market: { steps: [tab("You"), link("Market")], end: END.market },
    news: { steps: [tab("You"), press("What's new"), view("Blitz")], end: END.news },
    older: { steps: [tab("You"), finishedGame()], end: END.results },
    alerts: { steps: [tab("You"), press("Settings"), view("Important")], end: END.important, setting: "level" },
    music: { steps: [tab("You"), press("Settings"), toggle("Music")], end: END.musicOn, setting: "music" },
    signout: { steps: [tab("You"), press("Settings"), press("Sign out")], end: END.signOutAsked },
    join: { steps: [joinSlot()], end: END.lobby },
  };
};

/**
 * The pages the live stack cannot show at will (a running Blitz season, a claim, a sealed chest, a paid entry, a
 * signed-in player without an emailed code, Connect's steps, the doorway's holds), opened in the app lab over its
 * fixtures (`?capture=1`: the lab's own header off) and measured at rest, with the reading pages and an unknown path's.
 */
const LAB_GAME = "0x5245414c4d53-7";
const LAB_PAGES = [
  ["first-visit", ""],
  ["home", ""],
  ["season-running", "season"],
  ["season-claim", "season"],
  ["reward-sealed", `results/${LAB_GAME}`],
  ["entry-choose", "blitz/slot-blitz-1630"],
  ["home", "profile"],
  ["home", "profile/settings"],
  ["home", "scroll"],
  ["first-visit", "terms"],
  ["first-visit", "privacy"],
  ["first-visit", "credits"],
  ["first-visit", "connect/start"],
  ["first-visit", "connect/start-refused"],
  ["first-visit", "connect/code"],
  ["first-visit", "connect/code-refused"],
  ["first-visit", "connect/discord"],
  ["first-visit", "connect/name"],
  ["first-visit", "connect/name-refused"],
  ["home", "doorway/map"],
  ["first-visit", "doorway/sign-in"],
  ["home", "doorway/waiting"],
  ["home", "doorway/preparing"],
  ["home", "no-such-page"],
];

/** Measured in the page: what a first-time viewer meets, read from the page's own bands. */
export const MEASURE = `(() => {
  const root = document.querySelector("[data-layout]");
  if (!root) return { path: location.pathname, missing: "page" };
  const visible = (el) => { const b = el.getBoundingClientRect(); const s = getComputedStyle(el); return b.width > 2 && b.height > 2 && s.visibility !== "hidden" && s.opacity !== "0"; };
  const inView = (el) => {
    const b = el.getBoundingClientRect();
    const x = b.left + b.width / 2, y = b.top + b.height / 2;
    if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return false;
    const hit = document.elementFromPoint(x, y);
    return hit !== null && (hit === el || el.contains(hit));
  };
  const words = (els) => els.map((el) => el.innerText.replace(/\\s+/g, " ").trim());
  const band = (name) => root.querySelector('[data-band="' + name + '"]');
  const navBands = [band("tabs"), band("bar")].filter(Boolean);
  const all = [...document.querySelectorAll("a[href], button")].filter(visible);
  const nav = all.filter((el) => navBands.some((navBand) => navBand.contains(el)));
  const page = all.filter((el) => !nav.includes(el));
  // A word's size as it displays: its CSS size, scaled with the SVG it is drawn in (a card's 960 px viewBox drawn at a
  // phone's 358 px shows its 16 px words at 6 px).
  const svgScale = (el) => {
    const svg = el.closest("svg");
    const width = svg?.viewBox?.baseVal?.width;
    return width ? svg.getBoundingClientRect().width / width : 1;
  };
  const cssSizes = [];
  const renderedSizes = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const el = node.parentElement;
    if (!el || !node.textContent.trim() || !visible(el)) continue;
    const size = parseFloat(getComputedStyle(el).fontSize);
    cssSizes.push(size);
    renderedSizes.push(Math.round(size * svgScale(el) * 10) / 10);
  }
  const body = band("body");
  // Where the page's content starts: its first words, controls, fields or pictures (its title row's or its body's: a
  // card's painting is the card) under the frame's edge, the desktop's bar or the phone's top row, so a spacer or a
  // band that moves the whole body down counts as space; and the body's left edge in the window (a column left for a
  // rail would be a gutter). A page's background is never content, wherever it is drawn: a picture hidden from
  // assistive technology, or held to the window (fixed) rather than to a card, as a step's window-wide painting is.
  const frame = band("bar") ?? band("top");
  const frameEdge = frame ? frame.getBoundingClientRect().bottom : 0;
  const isBackground = (el) => {
    for (let node = el; node && node !== root; node = node.parentElement)
      if (node.getAttribute("aria-hidden") === "true" || getComputedStyle(node).position === "fixed") return true;
    return false;
  };
  const isContent = (el) =>
    [...el.childNodes].some((node) => node.nodeType === 3 && node.textContent.trim()) ||
    el.matches("a[href], button, input, select, textarea") ||
    (el.matches("img") && !isBackground(el));
  const shown = [band("title"), body].filter(Boolean).flatMap((part) => [...part.querySelectorAll("*")]).filter((el) => visible(el) && isContent(el));
  return {
    path: location.pathname + location.search,
    controls: page.length,
    controlsInView: page.filter(inView).length,
    nav: nav.length,
    gold: words(all.filter((el) => el.tagName === "BUTTON" && (/primary/.test(el.className) || el.dataset.kind === "primary"))),
    smallestText: renderedSizes.length ? Math.min(...renderedSizes) : null,
    smallestCssText: cssSizes.length ? Math.min(...cssSizes) : null,
    notice: band("notice") !== null,
    fits: (!body || body.scrollHeight <= body.clientHeight + 2) && document.documentElement.scrollHeight <= innerHeight + 2,
    contentTop: shown.length ? Math.round(Math.min(...shown.map((el) => el.getBoundingClientRect().top)) - frameEdge) : null,
    contentLeft: body ? Math.round(Math.min(...[...body.children].filter(visible).map((el) => el.getBoundingClientRect().left))) : null,
  };
})()`;

/**
 * Content starts within this far under the frame's edge (a title row's padding; a band or painting above the content
 * is more), on desktop this near the window's left edge, and every word displays at least this large.
 */
const CONTENT_TOP_LIMIT = 64;
const CONTENT_LEFT_LIMIT = 64;
const SMALLEST_TEXT = 14;

/**
 * A measured page's layout checks: its content at the top, every word readable as displayed, and on desktop no gutter
 * at its left. The top is the first content in any column: a column pushed down beside one that starts at the top
 * passes, so the screenshots stay the evidence for each column.
 */
export const layoutChecks = (measured, layout) => [
  {
    check: "content at the top",
    value: measured.contentTop,
    ok: measured.contentTop !== null && measured.contentTop <= CONTENT_TOP_LIMIT,
  },
  {
    check: "readable text",
    value: measured.smallestText,
    ok: measured.smallestText !== null && measured.smallestText >= SMALLEST_TEXT,
  },
  ...(layout === "desktop"
    ? [
        {
          check: "no left gutter",
          value: measured.contentLeft,
          ok: measured.contentLeft !== null && measured.contentLeft <= CONTENT_LEFT_LIMIT,
        },
      ]
    : []),
];

/**
 * Finds the control a step names and marks it for the browser's click; a link that leaves the app is read, never
 * followed. What was found, or null.
 */
const FIND = (step, mark) => `(() => {
  const step = ${JSON.stringify(step)};
  const text = (el) => el.innerText.replace(/\\s+/g, " ").trim();
  const body = document.querySelector('[data-band="body"]');
  const controls = (root, css) => (root ? [...root.querySelectorAll(css)] : []);
  const pageControls = [...controls(body, "a[href], button"), ...controls(document.querySelector('[data-band="foot"]'), "a[href], button"), ...controls(document, "[data-kit-sheet] button")];
  let found;
  // A place by its name: its word, or where it shows the player ("You: Maelis"), its own word before the name.
  const nameOf = (el) => el.getAttribute("aria-label") ?? text(el);
  if (step.kind === "tab") found = [...document.querySelectorAll('[data-role="tab"]')].find((el) => nameOf(el) === step.word || nameOf(el).startsWith(step.word + ": "));
  if (step.kind === "press" && step.word === "first") found = controls(body, "button").find((el) => !el.closest("[role=radiogroup]"));
  else if (step.kind === "press") found = pageControls.find((el) => text(el) === step.word);
  // A view of one thing: a switch's option, or a tab of the app sheet's tabs.
  if (step.kind === "view") found = [...document.querySelectorAll('[role="radio"], [role="tab"]')].find((el) => text(el) === step.word);
  if (step.kind === "toggle") found = document.querySelector('[role="switch"][aria-label="' + step.word + '"]');
  // A board's first place: the row ranked 1, itself the button that opens it.
  if (step.kind === "first-row") found = controls(body, "button.app-row").find((row) => row.querySelector(".app-rank")?.innerText.trim() === "1");
  if (step.kind === "finished-game") {
    const games = controls(body, 'a[href^="/results/"]');
    found = games[1] ?? games[0];
  }
  if (step.kind === "link") found = [...document.querySelectorAll("a[href]")].find((el) => text(el) === step.word);
  if (!found) return null;
  if (step.kind === "link" && found.target === "_blank") return { word: step.word, link: found.href, target: found.target, followed: false };
  found.setAttribute("data-proof-press", ${JSON.stringify(mark)});
  return { word: text(found) || found.getAttribute("aria-label"), selector: '[data-proof-press="' + ${JSON.stringify(mark)} + '"]' };
})()`;

/** The lines in which the page names a service that did not answer. */
const FAILURE_LINES = `[...document.querySelectorAll("[data-layout]")].flatMap((root) => root.innerText.split("\\n")).filter((line) => line.includes("did not answer"))`;

/**
 * A step whose control is not on the page: a row the live data may not hold is unavailable; any other control (a place,
 * a button, a link every page of its kind has) failed.
 */
export const missingVerdict = (step) =>
  step.live
    ? { status: "unavailable", reason: `no ${step.kind} on the page` }
    : { status: "failed", reason: "not on the page" };

/**
 * A flow whose last press landed but whose end did not come: unavailable only when the service the end reads (the
 * flow's `outage`) names its own failure on the page; any other line on the page explains nothing, and the flow failed.
 */
export const endVerdict = (flow, failures) =>
  flow.outage && failures.includes(flow.outage)
    ? { status: "unavailable", reason: flow.outage }
    : { status: "failed", reason: "end not reached", failures };

let marks = 0;

/** Presses one step as a player would; the step with its status and the address it led to. */
export const pressStep = async (b, step) => {
  const mark = `p${(marks += 1)}`;
  const found = b.evaluate(FIND(step, mark));
  if (found === null) return { step, ...missingVerdict(step), failures: b.evaluate(FAILURE_LINES) };
  // A link that leaves the app is read where it was found, never followed: the only step that leads without a click.
  if (found.link) return { step, status: "led", ...found };
  const missed = clickAsPlayer(b, found.selector);
  if (missed) return { step, word: found.word, status: "failed", reason: missed };
  await sleep(SETTLE_MS);
  return { step, word: found.word, status: "led", led: pathOf(b.url()) };
};

/** The flow's last press: it leads only when the flow's end is reached. */
const pressLast = async (b, step, flow, record) => {
  const last = await pressStep(b, step);
  record.presses.push(last);
  if (last.status !== "led") return;
  record.pages.push(b.evaluate(MEASURE));
  if (!(await waitFor(b, flow.end, END_TIMEOUT_MS))) Object.assign(last, endVerdict(flow, b.evaluate(FAILURE_LINES)));
};

/** The alert level lit on Settings, and the music switch. */
const SETTING_READS = {
  level: `document.querySelector('[role="radio"][aria-checked="true"]')?.innerText.trim() ?? null`,
  music: `document.querySelector('[role="switch"][aria-label="Music"]')?.getAttribute("aria-checked") ?? null`,
};
/** The press that sets a setting to `value` from another: the level's own view, or the music switch's flip. */
const SETTING_PRESSES = { level: (value) => view(value), music: () => toggle("Music") };

/**
 * A setting on the account's Settings page: read where the player is, and set by opening Settings fresh and pressing
 * its control, then read again after a reload, so what is checked is what the account kept.
 */
const settingOf = (b, baseUrl, name) => {
  const read = async () => {
    await waitFor(b, `(${SETTING_READS[name]}) !== null`, READY_TIMEOUT_MS);
    return b.evaluate(SETTING_READS[name]);
  };
  const openSettings = async () => {
    b.run("open", `${baseUrl}/profile/settings`, "--ignore-https-errors");
    await waitFor(b, READY, READY_TIMEOUT_MS);
  };
  const write = async (value) => {
    await openSettings();
    if ((await read()) !== value) {
      const pressed = await pressStep(b, SETTING_PRESSES[name](value));
      if (pressed.status !== "led") throw new Error(`${name}: ${pressed.reason}`);
    }
    await openSettings();
  };
  return { name, read, write };
};

/**
 * Runs `change` with the setting's value read first, and sets it back to that value however `change` ends, recording
 * on `record.restored` what it found after. A setting it cannot read is not pressed.
 */
export const changingSetting = async (setting, record, change) => {
  const before = await setting.read();
  if (before === null) {
    record.presses.push({ setting: setting.name, status: "failed", reason: "setting not readable before its press" });
    return;
  }
  try {
    await change();
  } finally {
    record.restored = await restore(setting, before);
  }
};

const restore = async (setting, before) => {
  try {
    await setting.write(before);
    const after = await setting.read();
    return { setting: setting.name, before, after, ok: after === before };
  } catch (error) {
    return { setting: setting.name, before, ok: false, error: String(error.message ?? error) };
  }
};

/** The body's words, so a record shows what a page said (a column of shares, a clock, a failure). */
const BODY_TEXT = `document.querySelector('[data-band="body"]')?.innerText.replace(/\\s+/g, " ").trim().slice(0, 600) ?? null`;

const parseArgs = (argv) => {
  const args = { baseUrl: "https://127.0.0.1:4176", out: join(process.cwd(), "shell-proof"), state: null, watch: null };
  for (let index = 0; index < argv.length; index += 2) {
    if (argv[index] === "--base-url") args.baseUrl = argv[index + 1].replace(/\/$/, "");
    else if (argv[index] === "--out") args.out = argv[index + 1];
    else if (argv[index] === "--state") args.state = argv[index + 1];
    else if (argv[index] === "--watch") args.watch = argv[index + 1].replace(/\/$/, "");
    else
      throw new Error(
        `Unknown argument ${argv[index]}; expected --base-url <url> --out <dir> [--state <file>] [--watch /g/<chain>/<game>]`,
      );
  }
  if (args.watch && !args.state)
    throw new Error("--watch plays the game: it needs --state, a player's signed-in state");
  return args;
};

const openPlay = async (b, baseUrl) => {
  b.run("open", `${baseUrl}/`, "--ignore-https-errors");
  const ready = await waitFor(b, READY, READY_TIMEOUT_MS);
  await sleep(SETTLE_MS);
  return ready;
};

/**
 * One flow from a fresh Play: its presses up to the last, then the last (inside the setting's put-back when it changes
 * one), and the screenshot of where it ended. Whatever stops it is kept on its record, and each page it passed through
 * is held to the layout checks.
 */
const runFlow = async (b, baseUrl, name, flow, layout, out) => {
  const record = { name, layout, at: new Date().toISOString(), ready: false, presses: [], pages: [] };
  try {
    record.ready = await openPlay(b, baseUrl);
    record.pages.push(b.evaluate(MEASURE));
    if (await pressLead(b, flow.steps.slice(0, -1), record)) {
      const finish = () => finishFlow(b, flow, record, out);
      if (flow.setting) await changingSetting(settingOf(b, baseUrl, flow.setting), record, finish);
      else await finish();
    } else screenshot(b, record, `${name}-${layout}.png`, out);
  } catch (error) {
    record.error = String(error.message ?? error);
  }
  record.checks = record.pages.flatMap((page) =>
    page.missing ? [] : layoutChecks(page, layout).map((check) => ({ path: page.path, ...check })),
  );
  return record;
};

/** The presses before the last, stopping at the first that did not lead; whether each led. */
export const pressLead = async (b, steps, record) => {
  for (const step of steps) {
    const pressed = await pressStep(b, step);
    record.presses.push(pressed);
    if (pressed.status !== "led") return false;
    record.pages.push(b.evaluate(MEASURE));
  }
  return true;
};

const finishFlow = async (b, flow, record, out) => {
  await pressLast(b, flow.steps.at(-1), flow, record);
  screenshot(b, record, `${record.name}-${record.layout}.png`, out);
};

const screenshot = (b, record, shot, out) => {
  b.run("screenshot", join(out, shot));
  record.screenshot = shot;
};

/** A lab fixture page, measured at rest: ready, and its content at the top with no gutter at its left. */
const measureLabPage = async (b, baseUrl, [screen, page], layout, out) => {
  // Play is the lab's root page.
  const named = page || "play";
  const record = { name: `lab ${screen} ${named}`, layout, ready: false, presses: [] };
  try {
    b.run("open", `${baseUrl}/lab/app/${screen}/${page}?capture=1`, "--ignore-https-errors");
    record.ready = await waitFor(b, READY, READY_TIMEOUT_MS);
    await sleep(SETTLE_MS);
    screenshot(b, record, `lab-${screen}-${named.replaceAll("/", "-")}-${layout}.png`, out);
    record.measured = b.evaluate(MEASURE);
    record.checks = layoutChecks(record.measured, layout);
    record.text = b.evaluate(BODY_TEXT);
  } catch (error) {
    record.error = String(error.message ?? error);
  }
  return record;
};

/** A game's scene, watched or played, as the boot leaves it once it is ready (GameRoute: `app-ready` only then). */
const GAME_SCENE = `/\\/(map|hex)$/.test(location.pathname) && document.documentElement.dataset.bootState === "app-ready"`;
const WATCHING = `${GAME_SCENE} && new URLSearchParams(location.search).get("spectate") === "true"`;
/**
 * From the press on, the page keeps each boot state it passes through, and the document's start: a reload loses both.
 */
const FOLLOW_BOOT = `(() => {
  const root = document.documentElement;
  window.__proofBoot = { origin: performance.timeOrigin, states: [root.dataset.bootState ?? null] };
  new MutationObserver(() => window.__proofBoot.states.push(root.dataset.bootState ?? null)).observe(root, {
    attributes: true,
    attributeFilter: ["data-boot-state"],
  });
  return performance.timeOrigin;
})()`;
/** The boot went through its doorway and came out ready on the game's scene, played. */
const PLAYING = `${GAME_SCENE} && !new URLSearchParams(location.search).has("spectate") && (window.__proofBoot?.states.includes("app-loading") ?? false)`;
const BOOT_SEEN = `({
  origin: performance.timeOrigin,
  states: window.__proofBoot?.states ?? null,
  path: location.pathname + location.search,
  chip: document.querySelector('button[aria-label="Identity"]')?.innerText.replace(/\\s+/g, " ").trim() ?? null,
})`;
const WATCH_TIMEOUT_MS = 120_000;
const PLAY_TIMEOUT_MS = 120_000;

/** The identity chip, and once it is open, its panel's Play: marked for the browser's click, or null. */
const CHIP = (mark) => `(() => {
  const chip = document.querySelector('button[aria-label="Identity"]');
  if (!chip) return null;
  chip.setAttribute("data-proof-press", ${JSON.stringify(mark)});
  return { word: chip.innerText.replace(/\\s+/g, " ").trim(), selector: '[data-proof-press="${mark}"]' };
})()`;
const CHIP_PLAY = (mark) => `(() => {
  const play = [...document.querySelectorAll("button")].find(
    (button) => button.innerText.trim() === "Play" && button.parentElement?.innerText.includes("Spectating this game."),
  );
  if (!play) return null;
  play.setAttribute("data-proof-press", ${JSON.stringify(mark)});
  return { word: "Play", panel: play.parentElement.innerText.replace(/\\s+/g, " ").trim(), selector: '[data-proof-press="${mark}"]' };
})()`;

/** Presses the control `find` marks, as a player would; the press with its status. */
const pressFound = async (b, find, kind) => {
  const found = b.evaluate(find);
  if (found === null) return { step: { kind }, status: "failed", reason: "not on the page" };
  const missed = clickAsPlayer(b, found.selector);
  if (missed) return { step: { kind }, word: found.word, status: "failed", reason: missed };
  await sleep(SETTLE_MS);
  return { step: { kind }, ...found, status: "led", led: pathOf(b.url()) };
};

/**
 * What a player is owed after Play, from what the page kept: the doorway shown and gone, the game's scene played and
 * not watched, the chip naming the player, and the same document throughout.
 */
export const watchToPlayChecks = (origin, seen) => {
  const states = seen.states ?? [];
  const chip = seen.chip ?? "";
  return [
    { check: "no reload", ok: seen.origin === origin && seen.states !== null, origin, after: seen.origin },
    {
      check: "the doorway shows, then goes",
      ok: states.includes("app-loading") && states.at(-1) === "app-ready",
      states,
    },
    {
      check: "the game played, not watched",
      ok: /\/(map|hex)(\?|$)/.test(seen.path) && !seen.path.includes("spectate"),
      path: seen.path,
    },
    {
      check: "the chip names the player",
      ok: chip !== "" && !/Spectating|Connecting|Choose a name|Sign in|Not signed in/.test(chip),
      chip,
    },
  ];
};

/** Watches the game, opens the chip, presses its Play, and holds the boot to watchToPlayChecks. */
const runWatchToPlay = async (b, baseUrl, game, layout, out) => {
  const record = { name: "watch-to-play", layout, at: new Date().toISOString(), ready: false, presses: [], checks: [] };
  try {
    b.run("open", `${baseUrl}${game}?spectate=true`, "--ignore-https-errors");
    record.ready = await waitFor(b, WATCHING, WATCH_TIMEOUT_MS);
    if (!record.ready) return record;
    await sleep(SETTLE_MS);
    const chip = await pressFound(b, CHIP("chip"), "chip");
    record.presses.push(chip);
    screenshot(b, record, `watch-to-play-1-chip-${layout}.png`, out);
    if (chip.status !== "led") return record;
    const origin = b.evaluate(FOLLOW_BOOT);
    const pressedAt = Date.now();
    const play = await pressFound(b, CHIP_PLAY("chip-play"), "chip-play");
    record.presses.push(play);
    if (play.status !== "led") return record;
    const played = await waitFor(b, PLAYING, PLAY_TIMEOUT_MS);
    record.msToPlaying = played ? Date.now() - pressedAt : null;
    // The scene settles its first frames before the picture.
    await sleep(SETTLE_MS * 2);
    record.seen = b.evaluate(BOOT_SEEN);
    record.checks = watchToPlayChecks(origin, record.seen);
    screenshot(b, record, `watch-to-play-2-playing-${layout}.png`, out);
  } catch (error) {
    record.error = String(error.message ?? error);
  }
  return record;
};

const main = async (argv) => {
  const { baseUrl, out, state, watch } = parseArgs(argv);
  const where = (record) => ({ name: record.name, layout: record.layout });
  if (watch) return proveWatchToPlay({ baseUrl, out, state, watch, where });
  const persona = state ? "returning" : "new-visitor";
  await runProof({ parent: out, name: `shell-proof-${persona}`, baseUrl, where }, async (b, dir, records) => {
    // A saved state carries the session and this device's key, so the run is the same device each time.
    if (state) b.run("--state", state, "open", "about:blank");
    for (const layout of Object.keys(VIEWPORTS)) {
      const [width, height] = VIEWPORTS[layout];
      b.run("set", "viewport", String(width), String(height));
      for (const [name, flow] of Object.entries(flows(layout, persona))) {
        const record = await runFlow(b, baseUrl, name, flow, layout, dir);
        records.push(record);
        console.log(
          `${persona} ${layout} ${name}: ${record.presses.map((step) => step.status).join(" → ") || record.error}`,
        );
        b.run("open", "about:blank");
      }
      // The lab answers as its fixtures' player, so it runs once, with the new visitor's fresh profile.
      if (!state) for (const labPage of LAB_PAGES) records.push(await measureLabPage(b, baseUrl, labPage, layout, dir));
    }
  });
};

/** The spectator's way back to play, at both sizes, each from a fresh watch of the game. */
const proveWatchToPlay = ({ baseUrl, out, state, watch, where }) =>
  runProof({ parent: out, name: "shell-proof-watch-to-play", baseUrl, where }, async (b, dir, records) => {
    b.run("--state", state, "open", "about:blank");
    for (const layout of Object.keys(VIEWPORTS)) {
      const [width, height] = VIEWPORTS[layout];
      b.run("set", "viewport", String(width), String(height));
      const record = await runWatchToPlay(b, baseUrl, watch, layout, dir);
      records.push(record);
      console.log(
        `watch-to-play ${layout}: ${record.presses.map((step) => step.status).join(" → ") || record.error || "not watching"}; ${record.checks.map((check) => `${check.check} ${check.ok ? "ok" : "FAILED"}`).join(", ")}`,
      );
      // A game page is closed once its picture is taken.
      b.run("open", "about:blank");
    }
  });

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main(process.argv.slice(2));
}
