import { JSDOM } from "jsdom";
import { expect, it } from "vitest";

import { closeAndReopen } from "./prove-frontier-feed.mjs";
import { problemsOf } from "./prove-run.mjs";

const FEED_PANEL = `<section aria-label="Feed"><div class="ui-event">Krump explored</div>__CLOSE__</section>`;

/**
 * A rail and its Feed place as the proof's browser meets them: the Feed's × (`close`: "works", "inert" or "missing")
 * and a place that opens the Feed again. Each click lands as a player's would, or fails as the browser says when the
 * control is covered.
 */
const browser = ({ close = "works", covered = false } = {}) => {
  const panel = FEED_PANEL.replace(
    "__CLOSE__",
    close === "missing" ? "" : `<button aria-label="Close the feed">×</button>`,
  );
  const dom = new JSDOM(`<main><div data-rail-home>${panel}</div><button aria-label="Feed">Feed</button></main>`, {
    runScripts: "outside-only",
  });
  const { document } = dom.window;
  // jsdom lays nothing out; every control here is on screen.
  dom.window.HTMLElement.prototype.getClientRects = () => [{}];
  const rail = document.querySelector("[data-rail-home]");
  const shots = [];
  return {
    shots,
    evaluate: (script) => dom.window.eval(script),
    run: (command, target) => {
      if (command === "screenshot") return shots.push(target);
      if (command !== "click") return undefined;
      if (covered) throw new Error("Element is covered by another element");
      const control = document.querySelector(target);
      if (control.getAttribute("aria-label") === "Close the feed" && close === "works") rail.innerHTML = "";
      if (control.getAttribute("aria-label") === "Feed" && !rail.firstChild) rail.innerHTML = panel;
      return undefined;
    },
  };
};

const prove = async (b) => {
  const record = { name: "desktop", ready: true, presses: [], checks: [] };
  await closeAndReopen(b, "desktop-closed.png", record, 0);
  return problemsOf([record], (r) => ({ device: r.name })).map((problem) => problem.problem);
};

it("passes a Feed its × closes and its place opens again, with the closed rail's screenshot", async () => {
  const b = browser();
  expect(await prove(b)).toEqual([]);
  expect(b.shots).toEqual(["desktop-closed.png"]);
});

it("fails a Feed without its × (review: a missing × left the proof complete)", async () => {
  expect(await prove(browser({ close: "missing" }))).toEqual(["missing"]);
});

it("fails a × a player cannot press, as the browser says", async () => {
  expect(await prove(browser({ covered: true }))).toEqual(["click: Element is covered by another element"]);
});

it("fails a × that leaves the Feed open", async () => {
  expect(await prove(browser({ close: "inert" }))).toEqual(["the × closes the Feed"]);
});
