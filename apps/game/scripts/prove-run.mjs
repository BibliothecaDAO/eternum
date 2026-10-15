/**
 * The proof commands' one run (prove-play, prove-shell): a browser session driven the way a player drives the real
 * client, each press made by the browser as a pointer makes it, and one meaning of a pass. A step is `led` when it
 * reached what it was pressed for, `unavailable` when what it needs is not there (a service down, a row the live data
 * does not hold), and `failed` otherwise; a run is complete only when every record became ready and every step led.
 * Each run writes its own directory, named by its start, and its record whatever happens, and the command exits 1 when
 * the run is incomplete.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { runAgentBrowser } from "./run-renderer-scene-smoke.mjs";

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** A session's commands. An evaluated expression comes back parsed; a page that returns JSON text is read once more. */
const browser = (session) => {
  const run = (...args) => runAgentBrowser(session, args);
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

/** Polls `js` in the page until it holds or the time runs out; whether it held. */
export const waitFor = async (b, js, timeoutMs) => {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    if (b.evaluate(`Boolean(${js})`) === true) return true;
    await sleep(300);
  }
  return false;
};

/** An address as a player reads it: its path and query, decoded. */
export const pathOf = (url) => {
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
 * Scrolls to the control `selector` names and clicks it through the browser, so a control the pointer cannot reach (off
 * screen past scrolling, covered) is not pressed. Null when the click landed, else what the browser said.
 */
export const clickAsPlayer = (b, selector) => {
  try {
    b.run("scrollintoview", selector);
    b.run("click", selector);
    return null;
  } catch (error) {
    return `click: ${browserError(error)}`;
  }
};

/**
 * Every reason a run is not complete: a record that never became ready, stopped on an error or was judged a problem, a
 * change it made and did not put back, and each step that did not lead. `where` names a record in its problems.
 */
export const problemsOf = (records, where) =>
  records.flatMap((record) => [
    ...(record.ready ? [] : [{ ...where(record), problem: "not ready" }]),
    ...(record.error ? [{ ...where(record), problem: record.error }] : []),
    // A step judged by its own check (a game's steps, prove-play-game.mjs) carries its verdict as its problem.
    ...(record.problem ? [{ ...where(record), problem: record.problem }] : []),
    ...(record.restored && !record.restored.ok
      ? [{ ...where(record), problem: "not put back", restored: record.restored }]
      : []),
    ...record.presses
      .flat()
      .flatMap((step) => (step.status === "led" ? [] : [{ ...where(record), problem: step.status, step }])),
  ]);

/**
 * Runs one proof: `prove(b, out, records)` drives the session and pushes its records, and the run's record is written to
 * `<parent>/run-<start>/<name>.json` however `prove` ends, with what it lists as problems.
 */
export const runProof = async ({ parent, name, baseUrl, where }, prove) => {
  const started = new Date().toISOString();
  const out = join(parent, `run-${started.replaceAll(":", "-")}`);
  mkdirSync(out, { recursive: true });
  const session = `${name}-${Date.now()}`;
  const b = browser(session);
  const records = [];
  try {
    await prove(b, out, records);
  } catch (error) {
    records.push({ name, ready: false, presses: [], error: String(error.message ?? error) });
  } finally {
    try {
      b.run("open", "about:blank");
      b.run("close");
    } catch {
      // The session is gone already; the record below is still written.
    }
    const problems = problemsOf(records, where);
    const proof = {
      started,
      ran: new Date().toISOString(),
      baseUrl,
      session,
      complete: problems.length === 0,
      problems,
      records,
    };
    writeFileSync(join(out, `${name}.json`), `${JSON.stringify(proof, null, 2)}\n`);
    console.log(
      `Wrote ${join(out, `${name}.json`)}: ${records.length} records, ${proof.complete ? "complete" : `INCOMPLETE (${problems.length} problems)`}`,
    );
    process.exitCode = proof.complete ? 0 : 1;
  }
};
