#!/usr/bin/env node
/**
 * The shell's proof: the places' flows pressed on the real client the way a player presses them, from a fresh Play,
 * with every press and the page it led to kept. Against a running dev build
 * (`pnpm --dir apps/game dev --host 127.0.0.1 --port <port>`):
 *
 *   pnpm --dir apps/game prove:shell --base-url https://127.0.0.1:<port> --out <dir> [--state <signed-in.json>]
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
      join: { steps: [joinSlot(), press("Sign in")], end: END.lobbySignIn },
    };
  return {
    ...shared,
    older: { steps: [tab("You"), finishedGame()], end: END.results },
    alerts: { steps: [tab("You"), press("Settings"), view("Important")], end: END.important, setting: "level" },
    music: { steps: [tab("You"), press("Settings"), toggle("Music")], end: END.musicOn, setting: "music" },
    signout: { steps: [tab("You"), press("Settings"), press("Sign out")], end: END.signOutAsked },
    join: { steps: [joinSlot()], end: END.lobby },
  };
};

/**
 * The pages the live stack cannot show at will (a running Blitz season, a claim, a sealed chest, a paid entry, a
 * signed-in player without an emailed code), opened in the app lab over its fixtures (`?capture=1`: the lab's own
 * header off) and measured at rest.
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
  const navBands = [band("tabs"), band("bar")].filter(Boolean);
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
  // Where the page's content starts: its first words or controls under the body's top edge (a painting above them is
  // space, not content), and its left edge in the window (a column left for a rail would be a gutter).
  const shown = body ? [...body.querySelectorAll("*")].filter((el) => visible(el) && ([...el.childNodes].some((node) => node.nodeType === 3 && node.textContent.trim()) || el.matches("a[href], button"))) : [];
  const bodyBox = body?.getBoundingClientRect();
  return JSON.stringify({
    path: location.pathname + location.search,
    controls: page.length,
    controlsInView: page.filter(inView).length,
    nav: nav.length,
    gold: words(all.filter((el) => el.tagName === "BUTTON" && /primary/.test(el.className))),
    smallestText: sizes.length ? Math.min(...sizes) : null,
    notice: band("notice") !== null,
    fits: (!body || body.scrollHeight <= body.clientHeight + 2) && document.documentElement.scrollHeight <= innerHeight + 2,
    contentTop: shown.length ? Math.round(Math.min(...shown.map((el) => el.getBoundingClientRect().top)) - bodyBox.top) : null,
    contentLeft: body ? Math.round(Math.min(...[...body.children].filter(visible).map((el) => el.getBoundingClientRect().left))) : null,
  });
})()`;

/** Content starts within this far of the body's top edge, and on desktop this near the window's left edge. */
const CONTENT_TOP_LIMIT = 160;
const CONTENT_LEFT_LIMIT = 64;

/** A measured page's layout checks: its content at the top, and on desktop no gutter at its left. */
export const layoutChecks = (measured, layout) => [
  {
    check: "content at the top",
    value: measured.contentTop,
    ok: measured.contentTop !== null && measured.contentTop <= CONTENT_TOP_LIMIT,
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
  // A desktop place carries its key beside its word ("You 3").
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
  if (step.kind === "link") found = [...document.querySelectorAll("a[href]")].find((el) => text(el) === step.word);
  if (!found) return JSON.stringify(null);
  if (step.kind === "link" && found.target === "_blank") return JSON.stringify({ word: step.word, href: found.href, target: found.target, followed: false });
  found.setAttribute("data-proof-press", ${JSON.stringify(mark)});
  return JSON.stringify({ word: text(found) || found.getAttribute("aria-label"), selector: '[data-proof-press="' + ${JSON.stringify(mark)} + '"]' });
})()`;

/** The lines in which the page names a service that did not answer. */
const FAILURE_LINES = `[...document.querySelectorAll("[data-layout]")].flatMap((root) => root.innerText.split("\\n")).filter((line) => line.includes("did not answer"))`;

/**
 * A step's verdict when the press did not reach what it was for: unavailable when the page names a service that did
 * not answer or the step needs a row the live data does not hold, else failed.
 */
export const stopVerdict = (step, failures, reason) => {
  if (failures.length > 0) return { status: "unavailable", reason: failures.join(" ") };
  if (step.live) return { status: "unavailable", reason: `no ${step.kind} on the page` };
  return { status: "failed", reason };
};

let marks = 0;

/** Presses one step as a player would; the step with its status and the address it led to. */
const pressStep = async (b, step) => {
  const mark = `p${(marks += 1)}`;
  const found = b.evaluate(FIND(step, mark));
  if (!found) return { step, ...stopVerdict(step, b.evaluate(FAILURE_LINES), "not on the page") };
  if (!found.selector) return { step, status: "led", ...found };
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
  if (!(await waitFor(b, flow.end, END_TIMEOUT_MS)))
    Object.assign(last, stopVerdict(step, b.evaluate(FAILURE_LINES), "end not reached"));
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

/**
 * One flow from a fresh Play: its presses up to the last, then the last (inside the setting's put-back when it changes
 * one), and the screenshot of where it ended. Whatever stops it is kept on its record.
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
  return record;
};

/** The presses before the last; whether each led. */
const pressLead = async (b, steps, record) => {
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

const main = async (argv) => {
  const { baseUrl, out, state } = parseArgs(argv);
  const persona = state ? "returning" : "new-visitor";
  const where = (record) => ({ name: record.name, layout: record.layout });
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

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main(process.argv.slice(2));
}
