/**
 * A game's paths for `prove:play --game <chain>:<game>`: the player's own game, driven signed in from a browser profile
 * (`--profile <dir>`, signed in once through the game's own sign-in; it holds a session, so it stays out of the repo and
 * the evidence). Each step leaves screenshots and a record of what the page showed, the address it reached, and the
 * page's errors:
 *
 * - `--until-end`: the map stays open until the game ends; **Game finished** → **See the results** must reach the
 *   game's own Results page.
 * - `--ended` (and after `--until-end`), at desktop and phone: an ended game's doorway **Results** and its map
 *   address's **Results** must each reach the game's own Results page.
 * - `--at-rest`, at desktop and phone: the map and the realm view as they open, nothing pressed, each with a screenshot
 *   and what a first-time viewer meets there (scripts/live-sample.mjs), so a change to the HUD is counted the same way
 *   before and after.
 * - `--watch`: the map and realm addresses as a spectator's (`?spectate=true`), so `--at-rest` shows a live game's
 *   HUD that the profile holds no seat in, nothing sent.
 * - `--tasks <task,task>`: each task from its view at rest, pressed as a player would, one press at a time with a
 *   screenshot after each, until its end state shows; its presses are its clicks (scripts/game-tasks.mjs).
 *
 * Every step fails on any page error or console error, which its record keeps as the browser gave them.
 */
import { join } from "node:path";

import { GAME_TASKS } from "./game-tasks.mjs";
import { LIVE_SAMPLE, sampleTotals } from "./live-sample.mjs";
import { pathOf } from "./prove-run.mjs";
import { sleep, waitFor } from "./proof-wait.mjs";
import { proveTask } from "./game-task-proof.mjs";
export { spiralPoints } from "./game-task-proof.mjs";

const VIEWPORTS = { desktop: [1440, 900], phone: [390, 844] };
const MAP_READY = `document.documentElement.dataset.bootState === "app-ready" && document.querySelector("canvas") !== null`;
const ENDED_LINE = "This game has ended.";
const READY_TIMEOUT_MS = 60_000;
const STEP_TIMEOUT_MS = 20_000;
/** How long a view settles after it is ready: the camera's opening move, the labels and the HUD's first reads. */
const AT_REST_SETTLE_MS = 8_000;

/** The game's own addresses: its doorway, its map, and its Results page. */
export const gameAddresses = (spec, { watch = false } = {}) => {
  const [chain, game] = spec.split(":");
  if (!chain || !/^\d+$/.test(game ?? "")) throw new Error(`--game expects <chain>:<game>, got ${spec}`);
  const doorway = `/g/${chain}/${game}`;
  const as = watch ? "?spectate=true" : "";
  return { doorway, map: `${doorway}/map${as}`, realm: `${doorway}/hex${as}`, results: `/results/${chain}-${game}` };
};

/** The page's errors and its console's error lines; warnings stay in the console but fail nothing. */
const errorsOf = ({ errors, console }) => [...errors, ...console.filter((line) => line.startsWith("[error]"))];

const judgeStep = (record) => {
  const problem = record.problem ?? (errorsOf(record.pageErrors).length ? "the page raised errors" : null);
  return problem ? { ...record, problem } : record;
};

const bodyText = (b) => b.evaluate("document.body.innerText");

const waitForText = (b, text, timeoutMs = STEP_TIMEOUT_MS) =>
  waitFor(b, `document.body.innerText.includes(${JSON.stringify(text)})`, timeoutMs);

/** Clicks the visible button whose words are exactly these, as a player would: scrolled to, then clicked. */
const pressButton = (b, word, within = "body") => {
  const selector = b.evaluate(`(() => {
    const button = [...document.querySelectorAll(${JSON.stringify(`${within} button`)})].find(
      (el) => el.innerText.replace(/\\s+/g, " ").trim() === ${JSON.stringify(word)} && el.getBoundingClientRect().width > 0,
    );
    if (!button) return null;
    button.setAttribute("data-proof-step", ${JSON.stringify(word)});
    return '[data-proof-step="' + ${JSON.stringify(word)} + '"]';
  })()`);
  if (!selector) return false;
  b.run("scrollintoview", selector);
  b.run("click", selector);
  return true;
};

/** The right column's **Log** button in `EventsCard`, and the Log window it opens on the game's history. */
export const LOG_BUTTON = 'button[aria-label="Log"]';
export const HISTORY = 'section[aria-label="Log"]';

/**
 * Every page error and console error or warning the session has raised, in order, with its full text. The browser
 * keeps both across navigations. They are read as JSON because the plain `errors` output drops each error's text, and
 * never cleared because `errors --clear` does not empty them (agent-browser 0.39.1).
 */
const sessionErrors = (b) => ({
  errors: JSON.parse(b.run("errors", "--json")).data.errors.map((error) => error.text),
  console: JSON.parse(b.run("console", "--json"))
    .data.messages.filter((message) => message.type === "error" || message.type === "warning")
    .map((message) => `[${message.type}] ${message.text}`),
});

/**
 * Each call returns what the session raised since the previous call: a step's errors from before its first navigation
 * until its last check, and nothing of the step before it.
 */
const errorsSinceLastStep = (b) => {
  let seen = { errors: 0, console: 0 };
  return () => {
    const all = sessionErrors(b);
    const step = { errors: all.errors.slice(seen.errors), console: all.console.slice(seen.console) };
    seen = { errors: all.errors.length, console: all.console.length };
    return step;
  };
};

const open = (b, url) => b.run("open", url, "--ignore-https-errors");

const shot = (b, out, name) => {
  b.run("screenshot", join(out, name));
  return name;
};

/** A view as it opens, nothing pressed: its screenshot and the sampler's count of what is on it. */
const proveAtRest = async (b, base, addresses, view, layout, out) => {
  const record = { step: `at-rest-${view}`, layout, screenshots: [] };
  b.run("set", "viewport", ...VIEWPORTS[layout].map(String));
  open(b, `${base}${addresses[view]}`);
  const ready = await waitFor(b, MAP_READY, READY_TIMEOUT_MS);
  await sleep(AT_REST_SETTLE_MS);
  record.screenshots.push(shot(b, out, `at-rest-${view}-${layout}.png`));
  if (!ready) return { ...record, problem: "map not ready" };
  const sample = b.evaluate(LIVE_SAMPLE);
  return { ...record, url: sample.url, totals: sampleTotals(sample.items), items: sample.items };
};

/** Stays on the map until the game ends, then leaves through Game finished → See the results. */
const proveGameFinished = async (b, base, addresses, layout, untilMs, out) => {
  const record = { step: "game-finished", layout, screenshots: [] };
  b.run("set", "viewport", ...VIEWPORTS[layout].map(String));
  open(b, `${base}${addresses.map}`);
  const ready = await waitFor(b, MAP_READY, READY_TIMEOUT_MS);
  record.screenshots.push(shot(b, out, `finished-1-${layout}-before.png`));
  if (!ready) return { ...record, problem: "map not ready" };
  if (!(await waitForText(b, "Game finished", untilMs))) return { ...record, problem: "the game did not end in time" };
  await sleep(3000);
  record.endedAt = new Date().toISOString();
  record.screenshots.push(shot(b, out, `finished-2-${layout}-ended.png`));
  pressButton(b, "Game finished");
  if (!(await waitForText(b, "See the results"))) return { ...record, problem: "Game finished opened nothing" };
  record.screenshots.push(shot(b, out, `finished-3-${layout}-sheet.png`));
  pressButton(b, "See the results");
  await waitFor(b, `location.pathname.startsWith("/results/")`, STEP_TIMEOUT_MS);
  await sleep(3000);
  record.led = pathOf(b.run("get", "url").split("\n").pop().trim());
  record.screenshots.push(shot(b, out, `finished-4-${layout}-results.png`));
  if (record.led !== addresses.results) return { ...record, problem: "See the results led elsewhere" };
  return record;
};

/** An ended game's entrance (its doorway or its map address) and where its Results leads. */
const proveEndedEntrance = async (b, base, addresses, entrance, layout, out) => {
  const record = { step: `ended-${entrance}`, layout, screenshots: [] };
  b.run("set", "viewport", ...VIEWPORTS[layout].map(String));
  open(b, `${base}${addresses[entrance]}`);
  const ended = await waitForText(b, ENDED_LINE, READY_TIMEOUT_MS);
  record.screenshots.push(shot(b, out, `ended-${entrance}-${layout}.png`));
  if (!ended) {
    record.saw = bodyText(b).split("\n").slice(0, 12);
    return { ...record, problem: `no "${ENDED_LINE}"` };
  }
  pressButton(b, "Results");
  await waitFor(b, `location.pathname.startsWith("/results/")`, STEP_TIMEOUT_MS);
  await sleep(2000);
  record.led = pathOf(b.run("get", "url").split("\n").pop().trim());
  record.screenshots.push(shot(b, out, `ended-${entrance}-${layout}-results.png`));
  if (record.led !== addresses.results) return { ...record, problem: "Results led elsewhere" };
  return record;
};

export const proveGame = async (b, { baseUrl, game, untilEndMinutes, ended, atRest, watch, tasks = [] }, out) => {
  const addresses = gameAddresses(game, { watch });
  const steps = [];
  if (atRest)
    for (const layout of Object.keys(VIEWPORTS))
      for (const view of ["map", "realm"]) steps.push(() => proveAtRest(b, baseUrl, addresses, view, layout, out));
  for (const name of tasks)
    for (const layout of GAME_TASKS[name].layouts)
      steps.push(() => proveTask(b, baseUrl, addresses, name, layout, out));
  if (untilEndMinutes)
    steps.push(() => proveGameFinished(b, baseUrl, addresses, "phone", untilEndMinutes * 60_000, out));
  if (ended || untilEndMinutes)
    for (const layout of Object.keys(VIEWPORTS))
      for (const entrance of ["doorway", "map"])
        steps.push(() => proveEndedEntrance(b, baseUrl, addresses, entrance, layout, out));
  const stepErrors = errorsSinceLastStep(b);
  const records = [];
  for (const step of steps) records.push(judgeStep({ ...(await step()), pageErrors: stepErrors() }));
  return { addresses, records };
};
