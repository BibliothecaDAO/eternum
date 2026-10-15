/**
 * A game's paths for `prove:play --game <chain>:<game>`: the player's own game, driven signed in from a browser profile
 * (`--profile <dir>`, signed in once through the game's own sign-in; it holds a session, so it stays out of the repo and
 * the evidence). Each step leaves screenshots and a record of what the page showed, the address it reached, and the
 * page's errors:
 *
 * - `--crate <col>,<row>`: a relic crate one of the player's armies stands next to. The map opens on that tile, the
 *   pointer moves over it until the game names it ("Relic Crate"), a click opens its panel, **Open** opens it, and after
 *   a reload the newest crate opening in the game's log must name exactly the relics the opened panel lists, each as
 *   often, as many as the closed panel advertised.
 * - `--until-end`: the map stays open until the game ends; **Game finished** → **See the results** must reach the
 *   game's own Results page.
 * - `--ended` (and after `--until-end`), at desktop and phone: an ended game's doorway **Results** and its map
 *   address's **Results** must each reach the game's own Results page.
 *
 * Every step fails on any page error or console error, which its record keeps as the browser gave them.
 */
import { join } from "node:path";

const VIEWPORTS = { desktop: [1440, 900], phone: [390, 844] };
const MAP_READY = `document.documentElement.dataset.bootState === "app-ready" && document.querySelector("canvas") !== null`;
const ENDED_LINE = "This game has ended.";
const READY_TIMEOUT_MS = 60_000;
const STEP_TIMEOUT_MS = 20_000;
/** How far from the tile the map opens on the pointer looks for the crate, and how finely. */
const CRATE_SEARCH = { radius: 240, step: 40 };

/** The game's own addresses: its doorway, its map, and its Results page. */
export const gameAddresses = (spec) => {
  const [chain, game] = spec.split(":");
  if (!chain || !/^\d+$/.test(game ?? "")) throw new Error(`--game expects <chain>:<game>, got ${spec}`);
  const doorway = `/g/${chain}/${game}`;
  return { doorway, map: `${doorway}/map`, results: `/results/${chain}-${game}` };
};

/** How many relics a closed crate's panel advertises: the number under "Relics", or null without one. */
const advertisedRelicCount = (contents) => {
  const at = contents.indexOf("Relics");
  const count = Number(contents[at + 1]);
  return at >= 0 && Number.isInteger(count) && count > 0 ? count : null;
};

/** The relics the log's newest crate opening names ("Relic crate opened", then "<army> · <relic>, <relic>"). */
const newestLoggedCrateRelics = (logLines) => {
  const at = logLines.indexOf("Relic crate opened");
  const description = logLines[at + 1];
  return at >= 0 && description ? description.split(" · ").at(-1).split(", ") : null;
};

const sameRelics = (a, b) => a.length === b.length && a.toSorted().join("\n") === b.toSorted().join("\n");

/** Why a crate's readings disagree: the closed panel's count, the opened panel's relics and the log's after a reload. */
const crateProblem = ({ panel, opened, log }) => {
  const advertised = advertisedRelicCount(panel.contents);
  const logged = newestLoggedCrateRelics(log);
  if (advertised === null) return "the closed crate's panel advertised no relic count";
  if (opened.length !== advertised) return `the panel advertised ${advertised} relics and listed ${opened.length}`;
  if (!logged) return "the log holds no crate opening after the reload";
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

/** Points around a centre, nearest first, so the pointer meets a centred tile in its first moves. */
export const spiralPoints = ([cx, cy], { radius, step }) => {
  const points = [];
  for (let dy = -radius; dy <= radius; dy += step)
    for (let dx = -radius; dx <= radius; dx += step) points.push([cx + dx, cy + dy]);
  return points.toSorted((a, b) => Math.hypot(a[0] - cx, a[1] - cy) - Math.hypot(b[0] - cx, b[1] - cy));
};

/** The panel's lines between two headings: the crate's contents sit between "Contents" and "Biome". */
export const linesBetween = (text, from, to) => {
  const lines = text.split("\n").map((line) => line.trim());
  const start = lines.indexOf(from);
  const end = lines.indexOf(to, start + 1);
  return start < 0 ? [] : lines.slice(start + 1, end < 0 ? undefined : end).filter(Boolean);
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const pathOf = (url) => {
  const { pathname, search } = new URL(url);
  return decodeURIComponent(`${pathname}${search}`);
};

const bodyText = (b) => b.evaluate("document.body.innerText");

const waitFor = async (b, js, timeoutMs) => {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    if (b.evaluate(`Boolean(${js})`) === true) return true;
    await sleep(500);
  }
  return false;
};

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

/** The Events card's **All**, which opens the game's log. */
const openEventsLog = (b) => {
  const selector = b.evaluate(`(() => {
    const heading = [...document.querySelectorAll("h2")].find((el) => el.innerText.trim() === "Events");
    const button = heading?.closest("section")?.querySelector("button");
    if (!button) return null;
    button.setAttribute("data-proof-step", "events-all");
    return '[data-proof-step="events-all"]';
  })()`);
  if (selector) b.run("click", selector);
};

const clickAt = (b, [x, y]) => {
  b.run("mouse", "move", String(x), String(y));
  b.run("mouse", "down");
  b.run("mouse", "up");
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
  const panel = bodyText(b);
  record.panel = { contents: linesBetween(panel, "Contents", "Open") };
  record.screenshots.push(shot(b, out, "crate-2-panel.png"));
  if (!pressButton(b, "Open")) return { ...record, problem: "no Open on the crate's panel" };
  if (!(await waitForText(b, "Crate opened", 60_000))) return { ...record, problem: "the crate did not open" };
  await sleep(1500);
  record.opened = linesBetween(bodyText(b), "Contents", "Biome");
  record.screenshots.push(shot(b, out, "crate-3-opened.png"));
  b.run("reload");
  if (!(await waitFor(b, MAP_READY, READY_TIMEOUT_MS))) return { ...record, problem: "map not ready after reload" };
  await sleep(3000);
  openEventsLog(b);
  await waitForText(b, "Relic crate opened");
  record.log = bodyText(b)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.includes("Relic"));
  record.screenshots.push(shot(b, out, "crate-4-log-after-reload.png"));
  return record;
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
 * The game's steps in order: the crate while the game runs, its end, then its ended entrances at both sizes. Each step
 * is judged with every error raised from its start to its end, however far it got.
 */
export const proveGame = async (b, { baseUrl, game, crate, untilEndMinutes, ended }, out) => {
  const addresses = gameAddresses(game);
  const steps = [];
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
