/**
 * A game's paths for `prove:play --game <chain>:<game>`: the player's own game, driven signed in from a browser profile
 * (`--profile <dir>`, signed in once through the game's own sign-in; it holds a session, so it stays out of the repo and
 * the evidence). Each step leaves screenshots and a record of what the page showed, the address it reached, and the
 * page's errors:
 *
 * - `--crate <col>,<row>`: a relic crate one of the player's armies stands next to. The map opens on that tile, the
 *   pointer moves over it until the game names it ("Relic Crate"), a click opens its panel, **Open** opens it, and after
 *   a reload the game's log must name the same relics the panel did.
 * - `--until-end`: the map stays open until the game ends; **Game finished** → **See the results** must reach the
 *   game's own Results page, and leaving must log no "No game client is active".
 * - `--ended` (and after `--until-end`), at desktop and phone: an ended game's doorway **Results** and its map
 *   address's **Results** must each reach the game's own Results page.
 */
import { join } from "node:path";

const VIEWPORTS = { desktop: [1440, 900], phone: [390, 844] };
const MAP_READY = `document.documentElement.dataset.bootState === "app-ready" && document.querySelector("canvas") !== null`;
const ENDED_LINE = "This game has ended.";
const NO_CLIENT = "No game client is active";
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

/** The relics a crate's panel listed that the game's log does not name. */
export const relicsMissingFromLog = (panelRelics, logText) => panelRelics.filter((name) => !logText.includes(name));

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

/** The page's errors and its console's, as the browser kept them since the last clear. */
const pageErrors = (b) => ({
  errors: b.run("errors"),
  console: b
    .run("console")
    .split("\n")
    .filter((line) => /error/i.test(line)),
});

const open = (b, url) => {
  b.run("open", url, "--ignore-https-errors");
  b.run("errors", "--clear");
  b.run("console", "--clear");
};

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
  const logged = await waitForText(b, "Relic crate opened");
  record.log = bodyText(b)
    .split("\n")
    .filter((line) => line.includes("Relic"));
  record.screenshots.push(shot(b, out, "crate-4-log-after-reload.png"));
  record.missingFromLog = logged ? relicsMissingFromLog(record.opened, record.log.join("\n")) : record.opened;
  record.pageErrors = pageErrors(b);
  if (!logged) return { ...record, problem: "the log holds no crate opening after the reload" };
  if (record.missingFromLog.length) return { ...record, problem: "the log names other relics than the panel" };
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
  record.pageErrors = pageErrors(b);
  const leftWithoutClient = [record.pageErrors.errors, ...record.pageErrors.console].join("\n").includes(NO_CLIENT);
  if (record.led !== addresses.results) return { ...record, problem: "See the results led elsewhere" };
  if (leftWithoutClient) return { ...record, problem: `leaving logged "${NO_CLIENT}"` };
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
  record.pageErrors = pageErrors(b);
  if (record.led !== addresses.results) return { ...record, problem: "Results led elsewhere" };
  return record;
};

/** The game's steps in order: the crate while the game runs, its end, then its ended entrances at both sizes. */
export const proveGame = async (b, { baseUrl, game, crate, untilEndMinutes, ended }, out) => {
  const addresses = gameAddresses(game);
  const records = [];
  if (crate) records.push(await proveCrate(b, baseUrl, addresses, crate, out));
  if (untilEndMinutes)
    records.push(await proveGameFinished(b, baseUrl, addresses, "phone", untilEndMinutes * 60_000, out));
  if (ended || untilEndMinutes)
    for (const layout of Object.keys(VIEWPORTS))
      for (const entrance of ["doorway", "map"])
        records.push(await proveEndedEntrance(b, baseUrl, addresses, entrance, layout, out));
  return { addresses, records };
};
