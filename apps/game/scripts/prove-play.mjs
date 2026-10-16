#!/usr/bin/env node
/**
 * Play's proof: drives the real client the way a player does and keeps what it saw. Against a running dev build
 * (`pnpm --dir apps/game dev --host 127.0.0.1 --port <port>`):
 *
 *   pnpm --dir apps/game prove:play --base-url https://127.0.0.1:<port> --out <dir>
 *
 * For each state, at desktop (1440×900) and phone (390×844), it opens Play, counts what is on it, then presses each of
 * its actions from a fresh load, scrolled to and clicked by the browser as a player would (so a control the pointer
 * cannot reach fails), and records where the press led. An action is a game's row and its verb (`data-play-item`), so
 * two rows with the same word are two presses, and each must reach its own game's address: a Watch on game 3 that opens
 * game 2 fails. States: the app lab's fixtures (`/lab/app/<screen>?capture=1`, so the lab's own header is off and the
 * page has the whole viewport) and the live root page signed out, once as it is and once with Blitz's slots read
 * failing (the request aborted). It needs no account and changes nothing: it stops at the first address a press reaches
 * (a lobby's Sign in excepted, which must return to that lobby), and leaves a game's page the moment its address is
 * recorded.
 *
 * With `--game <chain>:<game> --profile <dir>` it proves that game's own paths instead, signed in: its views counted at
 * rest, a crate opened and read back after a reload, Game finished → See the results, and an ended game's two Results
 * entrances (scripts/prove-play-game.mjs).
 *
 * Each run writes a new directory under <out>, named by its start time, so an earlier run's evidence is never replaced:
 * play-proof.json and one screenshot per state and viewport, whatever happens. The run is complete only when every page
 * became ready and every action reached its own address; otherwise the record lists the problems and the command exits
 * 1. A press whose row is gone on the fresh load is recorded as unavailable (live data moved), apart from a press that
 * failed.
 */
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { GAME_TASKS } from "./game-tasks.mjs";
import { proveGame } from "./prove-play-game.mjs";
import { clickAsPlayer, pathOf, runProof, sleep, waitFor } from "./prove-run.mjs";

const VIEWPORTS = { desktop: [1440, 900], phone: [390, 844] };
const LAB_SCREENS = ["first-visit", "home", "no-realm", "blitz-seat", "blitz-preparing", "season-over"];
const SETTLE_MS = 1500;
const READY_TIMEOUT_MS = 20_000;
const PRESS_TIMEOUT_MS = 5_000;
/** shell/play/seen-results.ts's storage key. */
const SEEN_RESULTS_KEY = "realms.seen-results";

/** A game an item names by its key: `chain:game` for a season, `game:chain:game` for a Blitz game. */
const gameOfItem = (item) => {
  const [chain, game] = item.startsWith("game:") ? item.split(":").slice(1) : item.split(":");
  return { chain, game };
};

const gamePath = (item) => `/g/${gameOfItem(item).chain}/${gameOfItem(item).game}`;
/** A slot's or a Blitz game's lobby: its key with `-` for `:` (shell/blitz/lobby.ts). */
const lobbyPath = (item) => `/blitz/${item.replaceAll(":", "-")}`;
const resultsPath = (item) => `/results/${gameOfItem(item).chain}-${gameOfItem(item).game}`;

/** Where each verb leads from its item: the exact address of that item's own game, lobby or results. */
const DESTINATIONS = {
  "Play free": (item) => `/sign-in?next=${gamePath(item)}`,
  Play: gamePath,
  Resume: gamePath,
  Enter: gamePath,
  Watch: (item) => `${gamePath(item)}?spectate=true`,
  Join: lobbyPath,
  "Take refund": lobbyPath,
  Lobby: lobbyPath,
  Results: resultsPath,
};

/**
 * The exact address a press must reach: its item's own destination, or for a lobby's Sign in, sign-in returning to the
 * lobby it was pressed from. Null for a word this proof does not know, which fails the press rather than passing it.
 */
export const destinationOf = (word, { item, from }) => {
  if (word === "Sign in") return from ? `/sign-in?next=${from}` : null;
  return item && DESTINATIONS[word] ? DESTINATIONS[word](item) : null;
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
  if (!root) return { missing: "page" };
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
  const nav = [band("tabs"), band("bar")].filter(Boolean).flatMap((el) => [...el.querySelectorAll("a[href], button")].filter(visible));
  const body = band("body");
  const actions = [...root.querySelectorAll("[data-play-item]")].flatMap((item) => {
    const button = item.querySelector("button");
    return button && visible(button) ? [{ item: item.dataset.playItem, word: word(button), inView: inView(button) }] : [];
  });
  return {
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
  };
})()`;

const READY = `document.documentElement.dataset.bootState === "app-ready" && document.body.innerText.includes("Now")`;

const USAGE =
  "expected --base-url <url> --out <dir>, and for a game --game <chain>:<game> --profile <dir> " +
  "[--at-rest] [--tasks <task,task>] [--crate <col>,<row>] [--until-end <minutes>] [--ended]";

export const parseArgs = (argv) => {
  const args = { baseUrl: "https://127.0.0.1:4176", out: join(process.cwd(), "play-proof") };
  for (let index = 0; index < argv.length; index += 1) {
    const value = () => argv[++index];
    if (argv[index] === "--base-url") args.baseUrl = value().replace(/\/$/, "");
    else if (argv[index] === "--out") args.out = value();
    else if (argv[index] === "--game") args.game = value();
    else if (argv[index] === "--profile") args.profile = value();
    else if (argv[index] === "--crate") args.crate = value().split(",").map(Number);
    else if (argv[index] === "--until-end") args.untilEndMinutes = Number(value());
    else if (argv[index] === "--ended") args.ended = true;
    else if (argv[index] === "--at-rest") args.atRest = true;
    else if (argv[index] === "--tasks") args.tasks = value().split(",");
    else throw new Error(`Unknown argument ${argv[index]}; ${USAGE}`);
  }
  if (args.game && !args.profile) throw new Error(`--game needs --profile; ${USAGE}`);
  const unknownTask = args.tasks?.find((task) => !GAME_TASKS[task]);
  if (unknownTask) throw new Error(`Unknown task ${unknownTask}; tasks: ${Object.keys(GAME_TASKS).join(", ")}`);
  return args;
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

/**
 * Presses one control as a player would, scrolling to it and then clicking, and returns where it led: `led` when it
 * reached the address expected of it, `unavailable` when the control is not on the page, `failed` when the click did
 * not land or led anywhere else.
 */
const press = async (b, { selector, word, expected }) => {
  const present = b.evaluate(`(() => {
    const button = document.querySelector(${JSON.stringify(selector)});
    return button !== null && button.innerText.replace(/\\s+/g, " ").trim() === ${JSON.stringify(word)};
  })()`);
  if (present !== true) return { word, status: "unavailable" };
  const before = b.url();
  const missed = clickAsPlayer(b, selector);
  if (missed) return { word, status: "failed", reason: missed };
  const until = Date.now() + PRESS_TIMEOUT_MS;
  let after = b.url();
  while (after === before && Date.now() < until) {
    await sleep(200);
    after = b.url();
  }
  return judge(word, expected, before, after);
};

/** A press's verdict from the addresses before and after it: led to the address it must reach, or failed and why. */
export const judge = (word, expected, before, after) => {
  const led = pathOf(after);
  if (after === before) return { word, status: "failed", reason: "no navigation", expected, led };
  if (expected === null) return { word, status: "failed", reason: "no known destination", expected, led };
  if (led !== expected) return { word, status: "failed", reason: "unexpected destination", expected, led };
  return { word, status: "led", expected, led };
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
    const expected = destinationOf(action.word, { item: action.item });
    const steps = [{ item: action.item, ...(await press(b, { selector, word: action.word, expected })) }];
    for (const word of steps[0].status === "led" ? (state.then?.[action.word] ?? []) : []) {
      await sleep(SETTLE_MS);
      const next = stepSelector(b, word);
      const expected = destinationOf(word, { from: steps.at(-1).led });
      steps.push(next ? await press(b, { selector: next, word, expected }) : { word, status: "unavailable" });
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

/** A Play record in the run's problems: its state and viewport. */
export const playRecordWhere = (record) => ({ state: record.state, layout: record.layout });

/**
 * A game's run: its own steps (scripts/prove-play-game.mjs), signed in from the browser profile, into game-proof.json.
 * A step is judged whole (judgeStep), its readiness included: its problem, if any, is the run's.
 */
const runGame = ({ baseUrl, out, profile, ...game }) => {
  process.env.AGENT_BROWSER_PROFILE = profile;
  return runProof({ parent: out, name: "game-proof", baseUrl, where: gameStepWhere }, async (b, dir, records) => {
    const { records: steps } = await proveGame(b, { baseUrl, ...game }, dir);
    records.push(...steps.map((step) => ({ ...step, ready: true, presses: [] })));
  });
};

/** A game's step in the run's problems: which step, and its viewport where it has one. */
const gameStepWhere = (record) => ({ step: record.step, layout: record.layout });

const main = async (argv) => {
  const args = parseArgs(argv);
  if (args.game) return runGame(args);
  const { baseUrl, out } = args;
  // One browser session for the whole run: a fresh profile, so no sign-in and no results marked seen.
  await runProof({ parent: out, name: "play-proof", baseUrl, where: playRecordWhere }, async (b, dir, records) => {
    for (const state of states(baseUrl)) {
      for (const layout of Object.keys(VIEWPORTS)) {
        try {
          const record = await proveState(b, state, layout, dir);
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
  });
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main(process.argv.slice(2));
}
