#!/usr/bin/env node
/**
 * Play's proof: drives the real client the way a player does and keeps what it saw. Against a running dev build
 * (`pnpm --dir apps/game dev --host 127.0.0.1 --port <port>`):
 *
 *   pnpm --dir apps/game prove:play --base-url https://127.0.0.1:<port> --out <dir>
 *
 * For each state, at desktop (1440×900) and phone (390×844), it opens Play, counts what is on it, then presses each of
 * its actions from a fresh load, scrolled to and clicked by the browser as a player would (so a control the pointer
 * cannot reach fails), and records where the press led. An action is a game's row and its verb (`data-play-item`), so two rows with
 * the same word are two presses. States: the app lab's fixtures (`/lab/app/<screen>?capture=1`, so the lab's own
 * header is off and the page has the whole viewport) and the live root page signed out, once as it is and once with
 * Blitz's slots read failing (the request aborted). It needs no account and changes nothing: it stops at the first
 * address a press reaches (a lobby's Sign in excepted), and leaves a game's page the moment its address is recorded.
 *
 * Writes <out>/play-proof.json and one screenshot per state and viewport, whatever happens. The run is complete only
 * when every page became ready and every action led where its verb leads; otherwise the record lists the problems and
 * the command exits 1. A press whose row is gone on the fresh load is recorded as unavailable (live data moved), apart
 * from a press that failed.
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

/** Where each verb leads: the address a press must reach to count as done. */
const DESTINATIONS = {
  "Play free": /^\/sign-in\?next=\/g\//,
  Play: /^\/g\/[^?]+$/,
  Resume: /^\/g\/[^?]+$/,
  Enter: /^\/g\/[^?]+$/,
  Watch: /^\/g\/.+[?&]spectate=true/,
  Join: /^\/blitz\/slot-/,
  Lobby: /^\/blitz\/game-/,
  "Take refund": /^\/blitz\/slot-/,
  Results: /^\/results\//,
  "Sign in": /^\/sign-in\?next=\/blitz\//,
};

/** Play's states: where each opens, and the steps that continue past a verb's first page (a lobby's Sign in). */
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
  const word = (el) => el.innerText.replace(/\\s+/g, " ").trim();
  const band = (name) => root.querySelector('[data-band="' + name + '"]');
  const controls = [...root.querySelectorAll("a[href], button")].filter(visible);
  const nav = [band("tabs"), band("rail")].filter(Boolean).flatMap((el) => [...el.querySelectorAll("a[href], button")].filter(visible));
  const body = band("body");
  const actions = [...root.querySelectorAll("[data-play-item]")].flatMap((item) => {
    const button = item.querySelector("button");
    return button && visible(button) ? [{ item: item.dataset.playItem, word: word(button), inView: inView(button) }] : [];
  });
  return JSON.stringify({
    controls: controls.length,
    controlsInView: controls.filter(inView).length,
    gold: controls.filter((el) => el.tagName === "BUTTON" && /primary/.test(el.className)).map(word),
    actions,
    modes: (body ? [...body.querySelectorAll("button[role=tab]")].filter(visible) : []).map(word),
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
  /** The page's value: agent-browser prints it as JSON; a page that returns JSON text (MEASURE) is read once more. */
  const evaluate = (js) => {
    const value = JSON.parse(run("eval", js));
    if (typeof value !== "string" || !/^[[{]/.test(value)) return value;
    try {
      return JSON.parse(value);
    } catch {
      return value;
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

const pathOf = (url) => {
  const { pathname, search } = new URL(url);
  return decodeURIComponent(`${pathname}${search}`);
};

/** What the browser said when a command failed, without npm's own warnings about the shell it ran in. */
const browserError = (error) =>
  error.message
    .split("\n")
    .filter((line) => line.trim() && !line.startsWith("npm warn"))
    .join(" ");

/**
 * Presses one control as a player would, scrolling to it and then clicking, and returns where it led: `led` when it
 * reached its verb's destination, `unavailable` when the control is not on the page, `failed` when the click did not
 * land or led elsewhere.
 */
const press = async (b, { selector, word }) => {
  const present = b.evaluate(`(() => {
    const button = document.querySelector(${JSON.stringify(selector)});
    return button !== null && button.innerText.replace(/\\s+/g, " ").trim() === ${JSON.stringify(word)};
  })()`);
  if (present !== true) return { word, status: "unavailable" };
  const before = b.url();
  try {
    b.run("scrollintoview", selector);
    b.run("click", selector);
  } catch (error) {
    return { word, status: "failed", reason: `click: ${browserError(error)}` };
  }
  const until = Date.now() + PRESS_TIMEOUT_MS;
  let after = b.url();
  while (after === before && Date.now() < until) {
    await sleep(200);
    after = b.url();
  }
  return judge(word, before, after);
};

/** A press's verdict from the addresses before and after it: led to its verb's destination, or failed and why. */
export const judge = (word, before, after) => {
  const led = pathOf(after);
  if (after === before) return { word, status: "failed", reason: "no navigation", led };
  const destination = DESTINATIONS[word];
  if (destination && !destination.test(led)) return { word, status: "failed", reason: "unexpected destination", led };
  return { word, status: "led", led };
};

/** A later step's control: a lobby's own button by its word, in its body (desktop) or its foot (phone). */
const stepSelector = (b, word) =>
  b.evaluate(`(() => {
    const buttons = [...document.querySelectorAll('[data-band="body"] button, [data-band="foot"] button')];
    const index = buttons.findIndex((el) => el.innerText.replace(/\\s+/g, " ").trim() === ${JSON.stringify(word)});
    if (index < 0) return null;
    buttons[index].setAttribute("data-proof-step", ${JSON.stringify(word)});
    return '[data-proof-step="' + ${JSON.stringify(word)} + '"]';
  })()`);

const leaveGamePage = (b) => {
  if (new URL(b.url()).pathname.startsWith("/g/")) b.run("open", "about:blank");
};

const proveState = async (b, state, layout, out) => {
  const [width, height] = VIEWPORTS[layout];
  b.run("set", "viewport", String(width), String(height));
  const ready = await openState(b, state);
  const page = b.evaluate(MEASURE);
  const at = new Date().toISOString();
  const shot = `${state.name}-${layout}.png`;
  b.run("screenshot", join(out, shot));
  const presses = [];
  for (const action of page.actions ?? []) {
    await openState(b, state);
    const selector = `[data-play-item="${action.item}"] button`;
    const steps = [{ item: action.item, ...(await press(b, { selector, word: action.word })) }];
    for (const word of steps[0].status === "led" ? (state.then?.[action.word] ?? []) : []) {
      await sleep(SETTLE_MS);
      const next = stepSelector(b, word);
      steps.push(next ? await press(b, { selector: next, word }) : { word, status: "unavailable" });
    }
    leaveGamePage(b);
    presses.push(steps);
  }
  return {
    state: state.name,
    layout,
    at,
    url: state.url,
    viewport: { width, height },
    ready,
    page,
    presses,
    screenshot: shot,
  };
};

/** Every reason the run is not complete: a page that never became ready, and each step that did not lead where it should. */
export const problemsOf = (records) =>
  records.flatMap((record) => [
    ...(record.ready ? [] : [{ state: record.state, layout: record.layout, problem: "not ready" }]),
    ...(record.error ? [{ state: record.state, layout: record.layout, problem: record.error }] : []),
    ...record.presses
      .flat()
      .flatMap((step) =>
        step.status === "led" ? [] : [{ state: record.state, layout: record.layout, problem: step.status, step }],
      ),
  ]);

const main = async (argv) => {
  const { baseUrl, out } = parseArgs(argv);
  mkdirSync(out, { recursive: true });
  const session = `play-proof-${Date.now()}`;
  const b = browser(session);
  const records = [];
  try {
    for (const state of states(baseUrl)) {
      for (const layout of Object.keys(VIEWPORTS)) {
        try {
          const record = await proveState(b, state, layout, out);
          records.push(record);
          console.log(
            `${record.state} ${layout}: ${JSON.stringify({ ...record.page, actions: record.page.actions?.length })}`,
          );
        } catch (error) {
          records.push({
            state: state.name,
            layout,
            at: new Date().toISOString(),
            ready: false,
            presses: [],
            error: String(error.message ?? error),
          });
        }
      }
    }
  } finally {
    try {
      b.run("open", "about:blank");
      b.run("close");
    } catch {
      // The session is gone already; the record below is still written.
    }
    const problems = problemsOf(records);
    const proof = {
      ran: new Date().toISOString(),
      baseUrl,
      session,
      complete: problems.length === 0,
      problems,
      records,
    };
    writeFileSync(join(out, "play-proof.json"), `${JSON.stringify(proof, null, 2)}\n`);
    console.log(
      `Wrote ${join(out, "play-proof.json")}: ${records.length} pages, ${proof.complete ? "complete" : `INCOMPLETE (${problems.length} problems)`}`,
    );
    process.exitCode = proof.complete ? 0 : 1;
  }
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main(process.argv.slice(2));
}
