/**
 * The proof commands' browser (prove-play, prove-shell): one agent-browser session driven the way a player drives the
 * real client, its page read back as JSON.
 */
import { runAgentBrowser } from "./run-renderer-scene-smoke.mjs";

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * A session's commands. An evaluated expression comes back parsed; a string answer that is itself JSON (a measure's
 * `JSON.stringify`) is parsed again, and any other string comes back as the string.
 */
export const browser = (session) => {
  const run = (...args) => runAgentBrowser(session, args);
  const evaluate = (js) => {
    const out = run("eval", js);
    let value;
    try {
      value = JSON.parse(out);
    } catch {
      return out;
    }
    if (typeof value !== "string") return value;
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
