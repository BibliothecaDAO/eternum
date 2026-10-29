import { GAME_TASKS } from "./game-tasks.mjs";
import { sleep, waitFor } from "./proof-wait.mjs";

/** The sizes a task runs at: a desktop, a phone upright, and the same phone on its side (the compact HUD's two lanes). */
const VIEWPORTS = { desktop: [1440, 900], wide: [1920, 1080], phone: [390, 844], landscape: [844, 390] };
const MAP_READY = `document.documentElement.dataset.bootState === "app-ready" && document.querySelector("canvas") !== null`;
const READY_TIMEOUT_MS = 60_000;
const STEP_TIMEOUT_MS = 20_000;
const AT_REST_SETTLE_MS = 8_000;
const CRATE_SEARCH = { radius: 240, step: 40 };
/** Another holding sits further off than a crate beside an army: the search reaches across the map's middle. */
const HOLDING_SEARCH = { radius: 480, step: 40 };
const open = (b, url) => b.run("open", url, "--ignore-https-errors");
const shot = async (b, out, name) => {
  await b.run("screenshot", `${out}/${name}`);
  return name;
};

/** Points around a centre, nearest first, so the pointer meets a centred tile in its first moves. */
export const spiralPoints = ([cx, cy], { radius, step }) => {
  const points = [];
  for (let dy = -radius; dy <= radius; dy += step)
    for (let dx = -radius; dx <= radius; dx += step) points.push([cx + dx, cy + dy]);
  return points.toSorted((a, b) => Math.hypot(a[0] - cx, a[1] - cy) - Math.hypot(b[0] - cx, b[1] - cy));
};

/**
 * Presses the first visible control inside `within` (or matched by it) whose words match `text`, scrolled to and clicked as a player
 * would; for `tile`, moves the pointer out from the screen's centre until the page's words match that pattern (the
 * map's tooltip naming an order), and clicks there (with `button`, right for an order sent at once); for `hover`, moves it out until the page shows words
 * matching that pattern and stops there, clicking nothing; for `holdingTile`, moves it out until it rests on
 * another of the player's holdings than the one selected, and clicks there; for `fill`, types `value` into that
 * field (a function of the run's token makes words this run alone wrote); for `drag`, drags the map from the screen's
 * centre by that offset, as a player moves it; for `key`, presses that key; for `word`, clicks the element showing
 * that word, as agent-browser finds it. A text press's `within` keeps only those holding the words `having` gives for
 * the run's token, and with `inside`, looks in what matches that inside them. False when nothing matched.
 */
const pressStep = async (b, press, layout, token) => {
  if (press.key) {
    await b.run("press", press.key);
    return true;
  }
  if (press.dblclick) {
    await b.run("dblclick", press.dblclick);
    return true;
  }
  if (press.word) {
    await b.run("find", "text", press.word, "click");
    return true;
  }
  if (press.fill) {
    await b.run("fill", press.fill, typeof press.value === "function" ? press.value(token) : press.value);
    return true;
  }
  if (press.drag) {
    const [cx, cy] = VIEWPORTS[layout].map((side) => side / 2);
    const [dx, dy] = press.drag;
    await b.run("mouse", "move", String(cx), String(cy));
    await b.run("mouse", "down", "left");
    for (const step of [1, 2, 3, 4])
      await b.run("mouse", "move", String(cx + (dx * step) / 4), String(cy + (dy * step) / 4));
    await b.run("mouse", "up", "left");
    return true;
  }
  if (press.tile)
    return clickTileWhere(
      b,
      layout,
      CRATE_SEARCH,
      press.button,
      `new RegExp(${JSON.stringify(press.tile)}).test(document.body.innerText)`,
    );
  if (press.holdingTile) return clickTileWhere(b, layout, HOLDING_SEARCH, press.button, ANOTHER_HOLDING_HOVERED);
  if (press.hover)
    return (
      (await pointAtTileWhere(
        b,
        layout,
        HOLDING_SEARCH,
        `new RegExp(${JSON.stringify(press.hover)}).test(document.body.innerText)`,
      )) !== null
    );
  const selector = await b.evaluate(findControl(press, token));
  if (!selector) return false;
  await b.run("scrollintoview", selector);
  await b.run("click", selector);
  return true;
};

/**
 * The page script a text press runs: marks the first visible control inside `within` (kept to those holding the
 * run's `having` words, then what matches `inside` in them) whose words or label match `text`, and names it; null when
 * none does.
 */
const findControl = (press, token) => `(() => {
    const CONTROL = "button, a[href], [role=button], [role=tab]";
    const having = ${JSON.stringify(press.having ? press.having(token) : null)};
    const inside = ${JSON.stringify(press.inside ?? null)};
    const scope = [...document.querySelectorAll(${JSON.stringify(press.within ?? "body")})]
      .filter((root) => having === null || root.innerText.includes(having))
      .flatMap((root) => (inside === null ? [root] : [...root.querySelectorAll(inside)]));
    const pattern = new RegExp(${JSON.stringify(press.text)});
    const control = scope
      .flatMap((root) => [root, ...root.querySelectorAll(CONTROL)].filter((el) => el.matches(CONTROL)))
      .find(
        (el) =>
          [el.innerText.replace(/\\s+/g, " ").trim(), el.getAttribute("aria-label") ?? ""].some((words) =>
            pattern.test(words),
          ) && el.getBoundingClientRect().width > 0,
      );
    if (!control) return null;
    document.querySelectorAll("[data-proof-press]").forEach((el) => el.removeAttribute("data-proof-press"));
    control.setAttribute("data-proof-press", "");
    return "[data-proof-press]";
  })()`;

/** The pointer rests on one of the player's holdings other than the one the HUD has selected. */
const ANOTHER_HOLDING_HOVERED = `(() => {
  const hovered = window.__eternumMapSelection?.hovered;
  return Boolean(hovered?.ownedByViewer && !hovered.selectedHolding);
})()`;

/** Moves the pointer out from the screen's centre until `found` holds, and leaves it there; null when it never does. */
const pointAtTileWhere = async (b, layout, search, found) => {
  const centre = VIEWPORTS[layout].map((side) => side / 2);
  for (const point of spiralPoints(centre, search)) {
    await b.run("mouse", "move", String(point[0]), String(point[1]));
    await sleep(150);
    if (await b.evaluate(found)) return point;
  }
  return null;
};

/** Points at the first tile where `found` holds, and clicks there with `button`. */
const clickTileWhere = async (b, layout, search, button = "left", found) => {
  const point = await pointAtTileWhere(b, layout, search, found);
  if (point === null) return false;
  await b.run("mouse", "move", ...point.map(String));
  await b.run("mouse", "down", button);
  await b.run("mouse", "up", button);
  return true;
};

/** One task from its view at rest: each press with the screenshot after it, then whether its end state shows. */
export const proveTask = async (b, base, addresses, name, layout, out) => {
  const task = GAME_TASKS[name];
  const record = { step: `task-${name}`, layout, task: task.goal, inputs: [], screenshots: [] };
  await b.run("set", "viewport", ...VIEWPORTS[layout].map(String));
  await open(b, `${base}${addresses[task.view]}`);
  if (!(await waitFor(b, MAP_READY, READY_TIMEOUT_MS)))
    return {
      ...record,
      screenshots: [await shot(b, out, `task-${name}-${layout}-not-ready.png`)],
      problem: "map not ready",
    };
  await sleep(AT_REST_SETTLE_MS);
  const presses = task.presses.filter((each) => !each.layout || each.layout === layout);
  // A token this run alone writes (a message's words), which its reading finds again.
  const token = `${name}-${Date.now().toString(36)}`;
  const reading = typeof task.reading === "function" ? task.reading(token) : task.reading;
  record.screenshots.push(await shot(b, out, `task-${name}-${layout}-before.png`));
  let before;
  for (const [index, press] of presses.entries()) {
    // The reading is taken where the order is given, just before its last press, so opening a panel counts for nothing.
    if (index === presses.length - 1 && reading) before = await b.evaluate(reading);
    const pressed = await pressStep(b, press, layout, token);
    await sleep(1500);
    record.inputs.push({ ...press, pressed });
    record.screenshots.push(await shot(b, out, `task-${name}-${layout}-${record.inputs.length}.png`));
    if (!pressed) return { ...record, problem: `nothing to press for ${press.name}` };
  }
  record.clicks = record.inputs.length;
  const outcome = await waitForOutcome(b, task, reading, before);
  record.done = outcome.problem === null;
  if (reading) record.reading = { token, before, after: outcome.after };
  record.screenshots.push(await shot(b, out, `task-${name}-${layout}-done.png`));
  return outcome.problem ? { ...record, problem: outcome.problem } : record;
};

/** Waits for a task's end state and, for a task that changes the game, for its reading to change as it expects. */
const waitForOutcome = async (b, task, reading, before) => {
  const until = Date.now() + STEP_TIMEOUT_MS;
  let outcome;
  do {
    const after = reading ? await b.evaluate(reading) : undefined;
    outcome = {
      after,
      problem: (await b.evaluate(`Boolean(${task.done})`))
        ? taskProblem(task, before, after)
        : "the task's end state did not show",
    };
    if (outcome.problem === null) return outcome;
    await sleep(500);
  } while (Date.now() < until);
  return outcome;
};

/**
 * Why a task's readings do not show its order, or null when they do: a task that changes the game has a reading on
 * both sides of its last press, changed as the task expects (one more farm, one more army, an army on another tile).
 */
const taskProblem = (task, before, after) => {
  if (!task.reading) return null;
  if (before === null || before === undefined || after === null || after === undefined)
    return "the task's reading was unavailable";
  return task.expect(before, after)
    ? null
    : `expected ${task.changes}, read ${JSON.stringify(before)} → ${JSON.stringify(after)}`;
};
