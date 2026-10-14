#!/usr/bin/env node
/**
 * Play's proof: drives the real client the way a player does and keeps what it saw. Against a running dev build
 * (`pnpm --dir apps/game dev --host 127.0.0.1 --port <port>`):
 *
 *   pnpm --dir apps/game prove:play --base-url https://127.0.0.1:<port> --out <dir>
 *
 * For each state, at desktop (1440×900) and phone (390×844), it opens Play, counts what is on it, then presses each of
 * its verbs from a fresh load and records where the press led. States: the app lab's fixtures
 * (`/lab/app/<screen>?capture=1`, so the lab's own header is off and the page has the whole viewport) and the live root
 * page signed out, once as it is and once with Blitz's slots read failing (the request aborted). It needs no account
 * and changes nothing: it stops at the first address a press reaches (a lobby, sign-in, a game), and leaves a game's
 * page the moment its address is recorded.
 *
 * Writes <out>/play-proof.json and one screenshot per state and viewport. A page's record holds its address, viewport,
 * its controls (all, and in view by a centre hit test), its gold buttons' words, its verbs, whether the notice shows,
 * whether the navigation is in view and the page fits, and any read failure it names.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { runAgentBrowser } from "./run-renderer-scene-smoke.mjs";

const VIEWPORTS = { desktop: [1440, 900], phone: [390, 844] };
const LAB_SCREENS = ["first-visit", "home", "no-realm", "blitz-seat", "blitz-preparing", "season-over"];
const SETTLE_MS = 1500;
const READY_TIMEOUT_MS = 20_000;
const PRESS_TIMEOUT_MS = 5_000;
/** shell/play/seen-results.ts's storage key. */
const SEEN_RESULTS_KEY = "realms.seen-results";

/** Play's states: where each opens, and the presses that continue past the first page (a lobby's Sign in). */
const states = (baseUrl) => [
  ...LAB_SCREENS.map((screen) => ({ name: `lab-${screen}`, url: `${baseUrl}/lab/app/${screen}?capture=1` })),
  { name: "live-signed-out", url: `${baseUrl}/`, then: { Join: ["Sign in"] } },
  { name: "live-slots-failing", url: `${baseUrl}/`, abort: "**/api/slots*" },
];

/** Measured in the page: what a first-time viewer meets on Play, read from the page's own bands. */
const MEASURE = `(() => {
  const root = document.querySelector("[data-layout]");
  if (!root) return JSON.stringify({ missing: "page" });
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
  const controls = [...root.querySelectorAll("a[href], button")].filter(visible);
  const nav = [band("tabs"), band("rail")].filter(Boolean).flatMap((el) => [...el.querySelectorAll("a[href], button")].filter(visible));
  const body = band("body");
  return JSON.stringify({
    controls: controls.length,
    controlsInView: controls.filter(inView).length,
    gold: words(controls.filter((el) => el.tagName === "BUTTON" && /primary/.test(el.className))),
    verbs: words(body ? [...body.querySelectorAll("button:not([role=tab])")].filter(visible) : []),
    modes: words(body ? [...body.querySelectorAll("button[role=tab]")].filter(visible) : []),
    notice: band("notice") !== null,
    navInView: nav.length > 0 && nav.every(inView),
    fits: (!body || body.scrollHeight <= body.clientHeight + 2) && document.documentElement.scrollHeight <= innerHeight + 2,
    failures: root.innerText.split("\\n").filter((line) => line.includes("did not answer")),
    quiet: root.innerText.includes("No season running"),
  });
})()`;

const READY = `document.documentElement.dataset.bootState === "app-ready" && document.body.innerText.includes("Now")`;

const parseArgs = (argv) => {
  const args = { baseUrl: "https://127.0.0.1:4176", out: join(process.cwd(), "play-proof") };
  for (let index = 0; index < argv.length; index += 2) {
    if (argv[index] === "--base-url") args.baseUrl = argv[index + 1].replace(/\/$/, "");
    else if (argv[index] === "--out") args.out = argv[index + 1];
    else throw new Error(`Unknown argument ${argv[index]}; expected --base-url <url> --out <dir>`);
  }
  return args;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** One browser session for the whole run: a fresh profile, so no sign-in and no results marked seen. */
const browser = (session) => {
  const run = (...args) => runAgentBrowser(session, args);
  const evaluate = (js) => {
    const out = run("eval", js);
    try {
      const value = JSON.parse(out);
      return typeof value === "string" ? JSON.parse(value) : value;
    } catch {
      return out;
    }
  };
  const url = () => run("get", "url").split("\n").pop().trim();
  return { run, evaluate, url };
};

const waitFor = async (b, js, timeoutMs) => {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    if (b.evaluate(`Boolean(${js})`) === true) return true;
    await sleep(300);
  }
  return false;
};

/**
 * Opens a state as a first look would: the results this device has seen are forgotten first, since pressing Results in
 * an earlier record marks them seen and would change what the next record finds.
 */
const openState = async (b, state) => {
  b.run("open", "about:blank");
  if (state.abort) b.run("network", "route", state.abort, "--abort");
  else b.run("network", "unroute");
  b.run("open", state.url, "--ignore-https-errors");
  b.evaluate(`localStorage.removeItem(${JSON.stringify(SEEN_RESULTS_KEY)})`);
  b.run("open", state.url, "--ignore-https-errors");
  const ready = await waitFor(b, READY, READY_TIMEOUT_MS);
  await sleep(SETTLE_MS);
  return ready;
};

/** Presses a verb by its word in the page's body and returns the address it led to (or where it stayed). */
const press = async (b, word) => {
  const before = b.url();
  const pressed = b.evaluate(`(() => {
    const button = [...document.querySelectorAll('[data-band="body"] button, [data-band="foot"] button')]
      .find((el) => el.innerText.replace(/\\s+/g, " ").trim() === ${JSON.stringify(word)});
    if (!button) return false;
    button.click();
    return true;
  })()`);
  if (pressed !== true) return { word, missing: true };
  const until = Date.now() + PRESS_TIMEOUT_MS;
  let after = b.url();
  while (after === before && Date.now() < until) {
    await sleep(200);
    after = b.url();
  }
  const { pathname, search } = new URL(after);
  return { word, led: decodeURIComponent(`${pathname}${search}`) };
};

const leaveGamePage = (b) => {
  if (new URL(b.url()).pathname.startsWith("/g/")) b.run("open", "about:blank");
};

const proveState = async (b, state, layout, out) => {
  const [width, height] = VIEWPORTS[layout];
  b.run("set", "viewport", String(width), String(height));
  const ready = await openState(b, state);
  const page = b.evaluate(MEASURE);
  const shot = `${state.name}-${layout}.png`;
  b.run("screenshot", join(out, shot));
  const presses = [];
  for (const word of [...new Set(page.verbs ?? [])].filter((verb) => verb !== "Try again")) {
    await openState(b, state);
    const steps = [await press(b, word)];
    for (const next of state.then?.[word] ?? []) {
      await sleep(SETTLE_MS);
      steps.push(await press(b, next));
    }
    leaveGamePage(b);
    presses.push(steps);
  }
  return {
    state: state.name,
    layout,
    url: state.url,
    viewport: { width, height },
    ready,
    page,
    presses,
    screenshot: shot,
  };
};

const main = async (argv) => {
  const { baseUrl, out } = parseArgs(argv);
  mkdirSync(out, { recursive: true });
  const session = `play-proof-${Date.now()}`;
  const b = browser(session);
  const records = [];
  try {
    for (const state of states(baseUrl)) {
      for (const layout of Object.keys(VIEWPORTS)) {
        const record = await proveState(b, state, layout, out);
        records.push(record);
        console.log(`${record.state} ${layout}: ${JSON.stringify(record.page)}`);
      }
    }
  } finally {
    b.run("open", "about:blank");
    b.run("close");
  }
  const proof = { ran: new Date().toISOString(), baseUrl, session, records };
  writeFileSync(join(out, "play-proof.json"), `${JSON.stringify(proof, null, 2)}\n`);
  console.log(`Wrote ${join(out, "play-proof.json")} (${records.length} pages)`);
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main(process.argv.slice(2));
}
