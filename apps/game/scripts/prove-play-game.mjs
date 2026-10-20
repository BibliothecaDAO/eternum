/**
 * A game's paths for `prove:play --game <chain>:<game>`: the player's own game, driven signed in from a browser profile
 * (`--profile <dir>`, signed in once through the game's own sign-in; it holds a session, so it stays out of the repo and
 * the evidence). Each step leaves screenshots and a record of what the page showed, the address it reached, and the
 * page's errors:
 *
 * - `--crate <col>,<row>`: a relic crate one of the player's armies stands next to. The map opens on that tile, the
 *   pointer moves over it until the game names it ("Relic Crate"), a click opens its panel, which must name the crate's
 *   pack and its three relics, all level II when the pack is lucky and all level I otherwise. **Open** opens it: the
 *   opened panel must list exactly those relics, and after a reload **Log** must open the game's history, which must
 *   hold "<pack> opened" naming them again.
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
import { proveTask, spiralPoints } from "./game-task-proof.mjs";
export { spiralPoints } from "./game-task-proof.mjs";

const VIEWPORTS = { desktop: [1440, 900], phone: [390, 844] };
const MAP_READY = `document.documentElement.dataset.bootState === "app-ready" && document.querySelector("canvas") !== null`;
const ENDED_LINE = "This game has ended.";
const READY_TIMEOUT_MS = 60_000;
const STEP_TIMEOUT_MS = 20_000;
/** How long a view settles after it is ready: the camera's opening move, the labels and the HUD's first reads. */
const AT_REST_SETTLE_MS = 8_000;
/** How far from the tile the map opens on the pointer looks for the crate, and how finely. */
const CRATE_SEARCH = { radius: 240, step: 40 };

/** The game's own addresses: its doorway, its map, and its Results page. */
export const gameAddresses = (spec, { watch = false } = {}) => {
  const [chain, game] = spec.split(":");
  if (!chain || !/^\d+$/.test(game ?? "")) throw new Error(`--game expects <chain>:<game>, got ${spec}`);
  const doorway = `/g/${chain}/${game}`;
  const as = watch ? "?spectate=true" : "";
  return { doorway, map: `${doorway}/map${as}`, realm: `${doorway}/hex${as}`, results: `/results/${chain}-${game}` };
};

const PACK_NAME = /^\S+ pack( · lucky)?$/;
const PACK_SIZE = 3;

/**
 * The pack a closed crate's panel advertises: its name line ("War pack · lucky"), then its relics up to "Victory
 * points". Null without a pack name.
 */
const advertisedPack = (contents) => {
  const at = contents.findIndex((line) => PACK_NAME.test(line));
  if (at < 0) return null;
  const end = contents.indexOf("Victory points", at + 1);
  return {
    name: contents[at],
    lucky: contents[at].endsWith(" · lucky"),
    relics: contents.slice(at + 1, end < 0 ? undefined : end),
  };
};

/** The relics the log's newest opening of this pack names ("<pack> opened", then "<army> · <relic>, <relic>"). */
const loggedPackRelics = (logLines, name) => {
  const at = logLines.indexOf(`${name} opened`);
  const description = logLines[at + 1];
  return at >= 0 && description ? description.split(" · ").at(-1).split(", ") : null;
};

const sameRelics = (a, b) => a.length === b.length && a.toSorted().join("\n") === b.toSorted().join("\n");

/** A lucky pack holds only level II relics, any other only level I. */
const matchesPackLevel = ({ lucky, relics }) => relics.every((relic) => relic.endsWith(lucky ? " II" : " I"));

/** Why a crate's readings disagree: the closed panel's pack, the opened panel's relics and the log's after a reload. */
const crateProblem = ({ panel, opened, log }) => {
  const pack = advertisedPack(panel.contents);
  if (!pack) return "the closed crate's panel named no pack";
  if (pack.relics.length !== PACK_SIZE)
    return `the panel advertised ${pack.relics.length} relics in the ${pack.name}, not ${PACK_SIZE}`;
  if (!matchesPackLevel(pack)) return `the ${pack.name} lists relics of the wrong level`;
  if (!sameRelics(opened, pack.relics)) return `the opened crate lists other relics than the ${pack.name} advertised`;
  const logged = loggedPackRelics(log, pack.name);
  if (!logged) return `the log holds no "${pack.name} opened" after the reload`;
  if (!sameRelics(opened, logged)) return "the log names other relics than the panel";
  return null;
};

/** The page's errors and its console's error lines; warnings stay in the console but fail nothing. */
const errorsOf = ({ errors, console }) => [...errors, ...console.filter((line) => line.startsWith("[error]"))];

/** A step's verdict: its own problem, else a crate that disagrees with itself, else any error the page raised. */
export const judgeStep = (record) => {
  const problem =
    record.problem ??
    (record.step === "crate" ? crateProblem(record) : null) ??
    (errorsOf(record.pageErrors).length ? "the page raised errors" : null);
  return problem ? { ...record, problem } : record;
};

/** The panel's lines between two headings: the crate's contents sit between "Contents" and "Biome". */
export const linesBetween = (text, from, to) => {
  const lines = text.split("\n").map((line) => line.trim());
  const start = lines.indexOf(from);
  const end = lines.indexOf(to, start + 1);
  return start < 0 ? [] : lines.slice(start + 1, end < 0 ? undefined : end).filter(Boolean);
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

/** The right column's **All** button in `EventsCard`, labelled Log, and the history its panel opens on. */
export const LOG_BUTTON = 'button[aria-label="Log"]';
export const HISTORY = 'section[aria-label="World history"]';

/** Presses **Log**, as a player would, and returns why the game's history did not open, or null once it shows. */
const openHistory = async (b) => {
  const found = b.evaluate(`(() => {
    const button = document.querySelector(${JSON.stringify(LOG_BUTTON)});
    if (!button) return false;
    button.setAttribute("data-proof-step", "log");
    return true;
  })()`);
  if (!found) return "no Log button to open the history";
  b.run("click", '[data-proof-step="log"]');
  if (!(await waitFor(b, `document.querySelector(${JSON.stringify(HISTORY)}) !== null`, STEP_TIMEOUT_MS)))
    return "Log opened no history";
  return null;
};

const historyText = (b) => b.evaluate(`document.querySelector(${JSON.stringify(HISTORY)})?.innerText ?? ""`);

const clickAt = (b, [x, y], button = "left") => {
  b.run("mouse", "move", String(x), String(y));
  b.run("mouse", "down", button);
  b.run("mouse", "up", button);
};

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

/** Finds the crate by pointer, opens it, reloads, and reads the game's log for the same relics. */
const proveCrate = async (b, base, addresses, [col, row], out) => {
  const record = { step: "crate", tile: { col, row }, screenshots: [] };
  b.run("set", "viewport", ...VIEWPORTS.desktop.map(String));
  open(b, `${base}${addresses.map}?col=${col}&row=${row}`);
  if (!(await waitFor(b, MAP_READY, READY_TIMEOUT_MS)))
    return { ...record, screenshots: [shot(b, out, "crate-0-not-ready.png")], problem: "map not ready" };
  await sleep(4000);
  const centre = [VIEWPORTS.desktop[0] / 2, VIEWPORTS.desktop[1] / 2];
  record.found = null;
  for (const point of spiralPoints(centre, CRATE_SEARCH)) {
    b.run("mouse", "move", String(point[0]), String(point[1]));
    await sleep(150);
    if (bodyText(b).includes("Relic Crate")) {
      record.found = point;
      break;
    }
  }
  record.screenshots.push(shot(b, out, "crate-1-found.png"));
  if (!record.found) return { ...record, problem: "the pointer found no crate near the tile" };
  clickAt(b, record.found);
  if (!(await waitFor(b, `/Crate #\\d+/.test(document.body.innerText)`, STEP_TIMEOUT_MS)))
    return { ...record, problem: "the crate's panel did not open" };
  record.panel = { contents: linesBetween(bodyText(b), "Contents", "Open") };
  const pack = advertisedPack(record.panel.contents);
  record.screenshots.push(shot(b, out, "crate-2-panel.png"));
  if (!pressButton(b, "Open")) return { ...record, problem: "no Open on the crate's panel" };
  if (!(await waitForText(b, "Crate opened", 60_000))) return { ...record, problem: "the crate did not open" };
  await sleep(1500);
  record.opened = linesBetween(bodyText(b), "Contents", "Biome");
  record.screenshots.push(shot(b, out, "crate-3-opened.png"));
  b.run("reload");
  if (!(await waitFor(b, MAP_READY, READY_TIMEOUT_MS))) return { ...record, problem: "map not ready after reload" };
  await sleep(3000);
  const historyProblem = await openHistory(b);
  if (historyProblem)
    return {
      ...record,
      screenshots: [...record.screenshots, shot(b, out, "crate-4-no-history.png")],
      problem: historyProblem,
    };
  if (pack)
    await waitFor(
      b,
      `(document.querySelector(${JSON.stringify(HISTORY)})?.innerText ?? "").includes(${JSON.stringify(`${pack.name} opened`)})`,
      STEP_TIMEOUT_MS,
    );
  record.log = historyText(b)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.endsWith(" opened") || line.includes("Relic"));
  record.screenshots.push(shot(b, out, "crate-4-log-after-reload.png"));
  return record;
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

/**
 * The game's steps in order: the views at rest, the tasks, the crate while the game runs, its end, then its ended entrances at both sizes. Each step
 * is judged with every error raised from its start to its end, however far it got.
 */
export const proveGame = async (
  b,
  { baseUrl, game, crate, untilEndMinutes, ended, atRest, watch, tasks = [] },
  out,
) => {
  const addresses = gameAddresses(game, { watch });
  const steps = [];
  if (atRest)
    for (const layout of Object.keys(VIEWPORTS))
      for (const view of ["map", "realm"]) steps.push(() => proveAtRest(b, baseUrl, addresses, view, layout, out));
  for (const name of tasks)
    for (const layout of GAME_TASKS[name].layouts)
      steps.push(() => proveTask(b, baseUrl, addresses, name, layout, out));
  if (crate) steps.push(() => proveCrate(b, baseUrl, addresses, crate, out));
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
