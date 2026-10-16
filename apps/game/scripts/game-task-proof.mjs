import { GAME_TASKS } from "./game-tasks.mjs";
import { sleep, waitFor } from "./proof-wait.mjs";

const VIEWPORTS = { desktop: [1440, 900], phone: [390, 844] };
const MAP_READY = `document.documentElement.dataset.bootState === "app-ready" && document.querySelector("canvas") !== null`;
const READY_TIMEOUT_MS = 60_000;
const STEP_TIMEOUT_MS = 20_000;
const AT_REST_SETTLE_MS = 8_000;
const CRATE_SEARCH = { radius: 240, step: 40 };
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
 * Presses the first visible control inside `within` whose words match `text`, scrolled to and clicked as a player
 * would; for `tile`, moves the pointer out from the screen's centre until the map's tooltip names that order, and
 * clicks there (with `button`, right for an order sent at once); for `key`, presses that key; for `word`, clicks
 * the element showing that word, as agent-browser finds it. False when nothing matched.
 */
const pressStep = async (b, press, layout) => {
  if (press.scroll) {
    await b.run("scrollintoview", press.scroll);
    return true;
  }
  if (press.drag) {
    const box = await b.evaluate(
      `(() => { const r = document.querySelector(${JSON.stringify(press.drag)}).getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`,
    );
    await b.run("mouse", "move", String(box.x), String(box.y));
    await b.run("mouse", "down", "left");
    await b.run("mouse", "move", String(box.x + press.delta[0]), String(box.y + press.delta[1]));
    await b.run("mouse", "up", "left");
    return true;
  }
  if (press.fill) {
    await b.run("fill", press.fill, press.valueFrom ? await b.evaluate(press.valueFrom) : press.value);
    return true;
  }
  if (press.select) {
    await b.run("select", press.select, press.value);
    return true;
  }
  if (press.selector) {
    await b.run("click", press.selector);
    return true;
  }
  if (press.point) {
    const point = press.point[layout];
    await b.run("mouse", "move", ...point.map(String));
    await b.run("mouse", "down", "left");
    await b.run("mouse", "up", "left");
    return true;
  }
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
  if (press.tile) {
    const centre = VIEWPORTS[layout].map((side) => side / 2);
    for (const point of spiralPoints(centre, CRATE_SEARCH)) {
      await b.run("mouse", "move", String(point[0]), String(point[1]));
      await sleep(150);
      if (await b.evaluate(`document.body.innerText.includes(${JSON.stringify(press.tile)})`)) {
        await b.run("mouse", "move", ...point.map(String));
        await b.run("mouse", "down", press.button ?? "left");
        await b.run("mouse", "up", press.button ?? "left");
        return true;
      }
    }
    return false;
  }
  const selector = await b.evaluate(`(() => {
    const scope = [...document.querySelectorAll(${JSON.stringify(press.within ?? "body")})];
    const pattern = new RegExp(${JSON.stringify(press.text)});
    const control = scope
      .flatMap((root) => [...root.querySelectorAll("button, a[href], [role=button], [role=tab]")])
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
  })()`);
  if (!selector) return false;
  await b.run("scrollintoview", selector);
  await b.run("click", selector);
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
  record.screenshots.push(await shot(b, out, `task-${name}-${layout}-before.png`));
  let before;
  for (const [index, press] of presses.entries()) {
    // The reading is taken where the order is given, just before its last press, so opening a panel counts for nothing.
    if (index === presses.length - 1 && task.reading) before = await b.evaluate(task.reading);
    const pressed = await pressStep(b, press, layout);
    await sleep(1500);
    record.inputs.push({ ...press, pressed });
    record.screenshots.push(await shot(b, out, `task-${name}-${layout}-${record.inputs.length}.png`));
    if (!pressed) return { ...record, problem: `nothing to press for ${press.name}` };
    if (press.check && !(await waitFor(b, press.check, STEP_TIMEOUT_MS)))
      return { ...record, problem: `after ${press.name}: expected result did not show` };
  }
  record.clicks = record.inputs.length;
  const outcome = await waitForOutcome(b, task, before);
  record.done = outcome.problem === null;
  if (task.reading) record.reading = { before, after: outcome.after };
  record.screenshots.push(await shot(b, out, `task-${name}-${layout}-done.png`));
  return outcome.problem ? { ...record, problem: outcome.problem } : record;
};

/** Waits for a task's end state and, for a task that changes the game, for its reading to change as it expects. */
const waitForOutcome = async (b, task, before) => {
  const until = Date.now() + STEP_TIMEOUT_MS;
  let outcome;
  do {
    const after = task.reading ? await b.evaluate(task.reading) : undefined;
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
