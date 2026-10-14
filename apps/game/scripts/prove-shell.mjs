#!/usr/bin/env node
/**
 * The shell's proof: the places' flows pressed on the real client the way a player presses them, from a fresh Play,
 * with every press and the page it led to kept. Against a running dev build
 * (`pnpm --dir apps/game dev --host 127.0.0.1 --port <port>`):
 *
 *   pnpm --dir apps/game prove:shell --base-url https://127.0.0.1:<port> --out <dir> [--state <signed-in.json>]
 *
 * Without `--state` it is a new visitor, and the run also opens the app lab's fixture pages (below); with a saved signed-in browser state (agent-browser's `state save`, which keeps
 * the device key with the session) a returning player. Each flow runs at desktop (1440×900) and phone (390×844).
 *
 * It changes nothing it does not put back and spends nothing: it stops at a lobby (paying is the player's), records
 * How to play's link without leaving, opens Sign out's question and keeps the session, and returns the alert level and
 * the music switch to what they were.
 *
 * Writes <out>/shell-proof-<new-visitor|returning>.json and a screenshot of each flow's end. A flow's record holds each press (what was pressed
 * and the address it led to), whether its end was reached, and each page passed through: its address, its controls
 * (all, and in view by a centre hit test, the navigation's apart), its gold buttons, its smallest text, and whether it
 * fits one screen.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { browser, sleep, waitFor } from "./prove-browser.mjs";

const VIEWPORTS = { desktop: [1440, 900], phone: [390, 844] };
const SETTLE_MS = 1500;
const READY_TIMEOUT_MS = 20_000;
const END_TIMEOUT_MS = 10_000;

const READY = `document.documentElement.dataset.bootState === "app-ready" && document.querySelector("[data-layout]")`;

/**
 * A press, by what a player sees: a place in the navigation, a row or button by its words, a switch view, a setting's
 * switch, the first board row, a finished game, or a link read without following it (it leaves the app).
 */
const tab = (word) => ({ kind: "tab", word });
const press = (word) => ({ kind: "press", word });
const view = (word) => ({ kind: "view", word });
const toggle = (word) => ({ kind: "toggle", word });
const firstRow = () => ({ kind: "first-row" });
const finishedGame = () => ({ kind: "finished-game" });
const link = (word) => ({ kind: "link", word });

/** Each flow's end, checked in the page. */
const END = {
  frontierBoard: `location.pathname === "/season" && [...document.querySelectorAll('[data-band="body"] button')].some((row) => /^1\\s/.test(row.innerText.trim()))`,
  blitzBoard: `location.pathname === "/season" && [...document.querySelectorAll('[data-band="body"] h2')].some((title) => title.innerText.trim().startsWith("Blitz")) && document.querySelector('[data-band="body"] ol li')`,
  player: `location.pathname.startsWith("/p/") && document.querySelector('[data-role="back"]')`,
  results: `location.pathname.startsWith("/results/") && document.querySelector('[data-role="back"]')`,
  important: `document.querySelector('[role="radio"][aria-checked="true"]')?.innerText.trim() === "Important"`,
  musicOn: `document.querySelector('[role="switch"][aria-label="Music"]')?.getAttribute("aria-checked") === "true"`,
  signOutAsked: `[...document.querySelectorAll("[data-kit-sheet]")].some((sheet) => sheet.innerText.includes("Sign out?"))`,
  docs: `[...document.querySelectorAll("a[href]")].some((a) => a.href.startsWith("https://docs.realms.world") && a.target === "_blank")`,
  news: `location.pathname.startsWith("/scroll/") || document.querySelector("[data-kit-sheet]")`,
  terms: `location.pathname === "/terms"`,
  signIn: `location.pathname === "/sign-in" && new URLSearchParams(location.search).get("next") === "/profile"`,
  lobby: `location.pathname.startsWith("/blitz/") && document.querySelector('[data-band="body"]')`,
  lobbySignIn: `location.pathname === "/sign-in" && (new URLSearchParams(location.search).get("next") ?? "").startsWith("/blitz/")`,
};

/** The flows, as the shell viewer's direction Q draws them; Blitz's board is a switch away on a phone. */
const flows = (layout, persona) => {
  const blitz = layout === "phone" ? [tab("Season"), view("Blitz")] : [tab("Season")];
  const shared = {
    standing: { steps: [tab("Season")], end: END.frontierBoard },
    blitzboard: { steps: blitz, end: END.blitzBoard },
    rival: { steps: [tab("Season"), firstRow()], end: END.player },
    guide: { steps: [tab("You"), link("How to play")], end: END.docs },
    news: { steps: [tab("You"), press("What's new"), press("first")], end: END.news },
    terms: { steps: [tab("You"), press("What's new"), link("Terms of Service")], end: END.terms },
  };
  if (persona === "new-visitor")
    return {
      ...shared,
      signin: { steps: [tab("You"), press("Sign in")], end: END.signIn },
      join: { steps: [press("Join"), press("Sign in")], end: END.lobbySignIn },
    };
  return {
    ...shared,
    older: { steps: [tab("You"), finishedGame()], end: END.results },
    alerts: { steps: [tab("You"), press("Settings"), view("Important")], end: END.important, restore: "level" },
    music: { steps: [tab("You"), press("Settings"), toggle("Music")], end: END.musicOn, restore: "music" },
    signout: { steps: [tab("You"), press("Settings"), press("Sign out")], end: END.signOutAsked, restore: "keep" },
    join: { steps: [press("Join")], end: END.lobby },
  };
};

/**
 * The pages the live stack cannot show at will (a running Blitz season, a claim, a sealed chest, a paid entry, a
 * signed-in player without an emailed code), opened in the app lab over its fixtures (`?capture=1`: the lab's own
 * header off) and measured at rest.
 */
const LAB_GAME = "0x5245414c4d53-7";
const LAB_PAGES = [
  ["season-running", "season"],
  ["season-claim", "season"],
  ["reward-sealed", `results/${LAB_GAME}`],
  ["entry-choose", "blitz/slot-blitz-1630"],
  ["home", "profile"],
  ["home", "profile/settings"],
  ["home", "scroll"],
];

/** Measured in the page: what a first-time viewer meets, read from the page's own bands. */
const MEASURE = `(() => {
  const root = document.querySelector("[data-layout]");
  if (!root) return JSON.stringify({ path: location.pathname, missing: "page" });
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
  const navBands = [band("tabs"), band("rail")].filter(Boolean);
  const all = [...document.querySelectorAll("a[href], button")].filter(visible);
  const nav = all.filter((el) => navBands.some((navBand) => navBand.contains(el)));
  const page = all.filter((el) => !nav.includes(el));
  const sizes = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const el = node.parentElement;
    if (el && node.textContent.trim() && visible(el)) sizes.push(parseFloat(getComputedStyle(el).fontSize));
  }
  const body = band("body");
  return JSON.stringify({
    path: location.pathname + location.search,
    controls: page.length,
    controlsInView: page.filter(inView).length,
    nav: nav.length,
    gold: words(all.filter((el) => el.tagName === "BUTTON" && /primary/.test(el.className))),
    smallestText: sizes.length ? Math.min(...sizes) : null,
    notice: band("notice") !== null,
    fits: (!body || body.scrollHeight <= body.clientHeight + 2) && document.documentElement.scrollHeight <= innerHeight + 2,
  });
})()`;

/** Finds the control a press names and presses it; a link is read, never followed. What was found, or null. */
const PRESS = (step) => `(() => {
  const step = ${JSON.stringify(step)};
  const text = (el) => el.innerText.replace(/\\s+/g, " ").trim();
  const body = document.querySelector('[data-band="body"]');
  const controls = (root, css) => (root ? [...root.querySelectorAll(css)] : []);
  const pageControls = [...controls(body, "a[href], button"), ...controls(document.querySelector('[data-band="foot"]'), "a[href], button"), ...controls(document, "[data-kit-sheet] button")];
  let found;
  // A rail place carries its key beside its word ("You 3").
  if (step.kind === "tab") found = [...document.querySelectorAll('[data-role="tab"]')].find((el) => text(el).replace(/ \\d$/, "") === step.word);
  if (step.kind === "press" && step.word === "first") found = controls(body, "button").find((el) => !el.closest("[role=radiogroup]"));
  else if (step.kind === "press") found = pageControls.find((el) => text(el) === step.word);
  if (step.kind === "view") found = [...document.querySelectorAll('[role="radio"]')].find((el) => text(el) === step.word);
  if (step.kind === "toggle") found = document.querySelector('[role="switch"][aria-label="' + step.word + '"]');
  if (step.kind === "first-row") found = controls(body, "button").find((el) => /^1\\s/.test(el.innerText.trim()));
  if (step.kind === "finished-game") {
    const games = controls(body, 'a[href^="/results/"]');
    found = games[1] ?? games[0];
  }
  if (step.kind === "link") {
    const anchor = [...document.querySelectorAll("a[href]")].find((el) => text(el) === step.word);
    if (!anchor) return JSON.stringify(null);
    if (anchor.target === "_blank") return JSON.stringify({ pressed: step.word, href: anchor.href, target: anchor.target, followed: false });
    found = anchor;
  }
  if (!found) return JSON.stringify(null);
  found.click();
  return JSON.stringify({ pressed: text(found) || found.getAttribute("aria-label") });
})()`;

const parseArgs = (argv) => {
  const args = { baseUrl: "https://127.0.0.1:4176", out: join(process.cwd(), "shell-proof"), state: null };
  for (let index = 0; index < argv.length; index += 2) {
    if (argv[index] === "--base-url") args.baseUrl = argv[index + 1].replace(/\/$/, "");
    else if (argv[index] === "--out") args.out = argv[index + 1];
    else if (argv[index] === "--state") args.state = argv[index + 1];
    else throw new Error(`Unknown argument ${argv[index]}; expected --base-url <url> --out <dir> [--state <file>]`);
  }
  return args;
};

const openPlay = async (b, baseUrl) => {
  b.run("open", `${baseUrl}/`, "--ignore-https-errors");
  const ready = await waitFor(b, READY, READY_TIMEOUT_MS);
  await sleep(SETTLE_MS);
  return ready;
};

/** The alert level lit on Settings, and the music switch. */
const LEVEL = `document.querySelector('[role="radio"][aria-checked="true"]')?.innerText.trim() ?? null`;
const MUSIC = `document.querySelector('[role="switch"][aria-label="Music"]')?.getAttribute("aria-checked") ?? null`;

/** What a mutating flow changed, read before it runs so it can be put back. */
const readBefore = (b, restore) => {
  if (restore === "level") return b.evaluate(LEVEL);
  if (restore === "music") return b.evaluate(MUSIC);
  return null;
};

const putBack = async (b, restore, before) => {
  if (restore === "music") b.evaluate(PRESS(toggle("Music")));
  if (restore === "keep") b.evaluate(PRESS(press("Keep")));
  if (restore === "level" && before) b.evaluate(PRESS(view(before)));
  await sleep(SETTLE_MS);
  if (restore === "level") return b.evaluate(LEVEL);
  if (restore === "music") return b.evaluate(MUSIC);
  return b.evaluate(`location.pathname`);
};

const runFlow = async (b, baseUrl, name, flow, layout, out) => {
  const ready = await openPlay(b, baseUrl);
  const pages = [b.evaluate(MEASURE)];
  const presses = [];
  let before = null;
  for (const [index, step] of flow.steps.entries()) {
    // The setting is read on Settings, the page before its press, so it can be put back.
    if (flow.restore && index === flow.steps.length - 1) before = readBefore(b, flow.restore);
    const pressed = b.evaluate(PRESS(step));
    if (!pressed) {
      presses.push({ step, missing: true });
      break;
    }
    await sleep(SETTLE_MS);
    presses.push({ step, ...pressed, led: decodeURIComponent(new URL(b.url()).pathname + new URL(b.url()).search) });
    pages.push(b.evaluate(MEASURE));
  }
  const reached = presses.every((each) => !each.missing) && (await waitFor(b, flow.end, END_TIMEOUT_MS));
  const shot = `${name}-${layout}.png`;
  b.run("screenshot", join(out, shot));
  const restored = flow.restore ? { before, after: await putBack(b, flow.restore, before) } : undefined;
  // A setting not put back is the account's to fix by hand: the run stops and says which.
  if (flow.restore !== "keep" && restored && restored.before !== restored.after)
    throw new Error(`${name}: ${flow.restore} was ${restored.before}, left ${restored.after}; set it back in Settings`);
  return {
    flow: name,
    layout,
    ready,
    presses: presses.length,
    steps: presses,
    reached,
    pages,
    restored,
    screenshot: shot,
  };
};

const measureLabPage = async (b, baseUrl, [screen, page], layout, out) => {
  b.run("open", `${baseUrl}/lab/app/${screen}/${page}?capture=1`, "--ignore-https-errors");
  const ready = await waitFor(b, READY, READY_TIMEOUT_MS);
  await sleep(SETTLE_MS);
  const shot = `lab-${screen}-${page.replaceAll("/", "-")}-${layout}.png`;
  b.run("screenshot", join(out, shot));
  return {
    lab: screen,
    page,
    layout,
    ready,
    measured: b.evaluate(MEASURE),
    text: b.evaluate(BODY_TEXT),
    screenshot: shot,
  };
};

/** The body's words, so a record shows what a page said (a column of shares, a clock, a failure). */
const BODY_TEXT = `document.querySelector('[data-band="body"]')?.innerText.replace(/\\s+/g, " ").trim().slice(0, 600) ?? null`;

const main = async (argv) => {
  const { baseUrl, out, state } = parseArgs(argv);
  mkdirSync(out, { recursive: true });
  const persona = state ? "returning" : "new-visitor";
  const session = `shell-proof-${Date.now()}`;
  const b = browser(session);
  // A saved state carries the session and this device's key, so the run is the same device each time.
  if (state) b.run("--state", state, "open", "about:blank");
  const records = [];
  try {
    for (const layout of Object.keys(VIEWPORTS)) {
      const [width, height] = VIEWPORTS[layout];
      b.run("set", "viewport", String(width), String(height));
      for (const [name, flow] of Object.entries(flows(layout, persona))) {
        const record = await runFlow(b, baseUrl, name, flow, layout, out);
        records.push(record);
        console.log(`${persona} ${layout} ${name}: ${record.reached ? "reached" : "NOT reached"} in ${record.presses}`);
        b.run("open", "about:blank");
      }
      // The lab answers as its fixtures' player, so it runs once, with the new visitor's fresh profile.
      if (!state) for (const labPage of LAB_PAGES) records.push(await measureLabPage(b, baseUrl, labPage, layout, out));
    }
  } finally {
    b.run("open", "about:blank");
    b.run("close");
  }
  const proof = { ran: new Date().toISOString(), baseUrl, persona, session, records };
  writeFileSync(join(out, `shell-proof-${persona}.json`), `${JSON.stringify(proof, null, 2)}\n`);
  console.log(`Wrote ${join(out, `shell-proof-${persona}.json`)} (${records.length} flows)`);
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main(process.argv.slice(2));
}
