import { describe, expect, it } from "vitest";

import { JSDOM } from "jsdom";

import { commandsOf, problemsOf } from "./prove-run.mjs";
import {
  changingSetting,
  endVerdict,
  layoutChecks,
  missingVerdict,
  pressLead,
  pressStep,
  watchToPlayChecks,
} from "./prove-shell.mjs";

/** A setting the account keeps: what Settings shows, and a write that may fail. */
const accountSetting = (value, { writeFails = false } = {}) => {
  const setting = {
    name: "level",
    value,
    read: async () => setting.value,
    write: async (next) => {
      if (writeFails) throw new Error("Settings did not open");
      setting.value = next;
    },
  };
  return setting;
};

const where = (record) => ({ name: record.name, layout: record.layout });
const flowRecord = () => ({ name: "alerts", layout: "phone", ready: true, presses: [] });

describe("a flow that changes a setting", () => {
  it("sets it back to the value read before its press when the flow fails after the change", async () => {
    const setting = accountSetting("Off");
    const record = flowRecord();
    const flow = changingSetting(setting, record, async () => {
      setting.value = "Important";
      throw new Error("screenshot: the page closed");
    });
    await expect(flow).rejects.toThrow("screenshot: the page closed");
    expect(setting.value).toBe("Off");
    expect(record.restored).toEqual({ setting: "level", before: "Off", after: "Off", ok: true });
  });

  it("sets back the value it found, not the other one", async () => {
    const setting = accountSetting("Important");
    const record = flowRecord();
    await changingSetting(setting, record, async () => {
      setting.value = "All";
    });
    expect(setting.value).toBe("Important");
  });

  it("keeps a change it could not put back as a problem of the run", async () => {
    const setting = accountSetting("Off", { writeFails: true });
    const record = flowRecord();
    await changingSetting(setting, record, async () => {
      setting.value = "Important";
    });
    expect(record.restored).toEqual({ setting: "level", before: "Off", ok: false, error: "Settings did not open" });
    expect(problemsOf([record], where)).toEqual([
      { name: "alerts", layout: "phone", problem: "not put back", restored: record.restored },
    ]);
  });

  it("presses nothing when it cannot read the setting first", async () => {
    const setting = accountSetting(null);
    const record = flowRecord();
    let changed = false;
    await changingSetting(setting, record, async () => {
      changed = true;
    });
    expect(changed).toBe(false);
    expect(problemsOf([record], where).map((problem) => problem.problem)).toEqual(["failed"]);
  });
});

/**
 * A page in jsdom behind agent-browser's command line as the proof drives it: `eval` prints the page script's value as
 * JSON, a click and a scroll are recorded, and the address is the page's.
 */
const pageSession = (html) => {
  const dom = new JSDOM(`<!doctype html><body>${html}</body>`, {
    url: "https://127.0.0.1:4182/season",
    runScripts: "outside-only",
  });
  // jsdom lays nothing out, so it has no innerText; the proof reads a control's words through it.
  Object.defineProperty(dom.window.HTMLElement.prototype, "innerText", {
    get() {
      return this.textContent;
    },
  });
  // Nor does it stand anything at a point: no control is ever covered.
  dom.window.document.elementFromPoint = () => null;
  const pointer = [];
  const run = (command, ...args) => {
    if (command === "eval") return JSON.stringify(dom.window.eval(args[0]) ?? null, null, 2);
    if (command === "get") return dom.window.location.href;
    pointer.push([command, ...args]);
    return "✓ Done";
  };
  return { b: commandsOf(run), pointer };
};

const BAR =
  '<nav data-band="bar"><a data-role="tab" href="/">Play 1</a><a data-role="tab" href="/season">Season 2</a></nav>';
const BODY = (inside) => `<div data-layout="desktop">${BAR}<main data-band="body">${inside}</main></div>`;

describe("a press through the page", () => {
  it("fails a missing place and never clicks, however the page answers", async () => {
    const { b, pointer } = pageSession(BODY("<p>Ratings did not answer.</p>"));
    const pressed = await pressStep(b, { kind: "tab", word: "You" });
    expect(pressed).toMatchObject({ status: "failed", reason: "not on the page" });
    expect(pointer).toEqual([]);
  });

  it("is unavailable for a live row the page does not hold, and never clicks", async () => {
    const { b, pointer } = pageSession(BODY("<p>No finished games yet.</p>"));
    expect(await pressStep(b, { kind: "finished-game", live: true })).toMatchObject({
      status: "unavailable",
      reason: "no finished-game on the page",
    });
    expect(pointer).toEqual([]);
  });

  it("reads a link that leaves the app without following it: the only step led with no click", async () => {
    const { b, pointer } = pageSession(BODY('<a href="https://docs.realms.party/" target="_blank">How to play</a>'));
    expect(await pressStep(b, { kind: "link", word: "How to play" })).toMatchObject({
      status: "led",
      link: "https://docs.realms.party/",
      followed: false,
    });
    expect(pointer).toEqual([]);
  });

  it("scrolls to and clicks a control it found, by the mark it gave it", async () => {
    const { b, pointer } = pageSession(BODY("<button>What's new</button>"));
    const pressed = await pressStep(b, { kind: "press", word: "What's new" });
    expect(pressed).toMatchObject({ status: "led", word: "What's new" });
    expect(pointer.map(([command]) => command)).toEqual(["scrollintoview", "click"]);
    expect(pointer[1][1]).toMatch(/^\[data-proof-press="p\d+"\]$/);
  });

  it("stops a flow at its first missing control, so a later control or an end already shown cannot carry it", async () => {
    const { b, pointer } = pageSession(BODY("<button>Sign in</button>"));
    const record = flowRecord();
    const led = await pressLead(
      b,
      [
        { kind: "press", word: "Join" },
        { kind: "press", word: "Sign in" },
      ],
      record,
    );
    expect(led).toBe(false);
    expect(record.presses.map((step) => step.status)).toEqual(["failed"]);
    expect(pointer).toEqual([]);
  });
});

describe("a flow whose end did not come", () => {
  it("failed when a present control was clicked and led elsewhere, even a live row", () => {
    expect(endVerdict({ end: "lobby" }, [])).toMatchObject({ status: "failed", reason: "end not reached" });
  });

  it("failed when the only failure on the page is another service's", () => {
    expect(endVerdict({ end: "lobby" }, ["Blitz did not answer."])).toMatchObject({ status: "failed" });
    expect(endVerdict({ end: "board", outage: "Ratings did not answer." }, ["Season did not answer."])).toMatchObject({
      status: "failed",
    });
  });

  it("unavailable when the service its end reads says it did not answer", () => {
    expect(endVerdict({ end: "board", outage: "Ratings did not answer." }, ["Ratings did not answer."])).toEqual({
      status: "unavailable",
      reason: "Ratings did not answer.",
    });
  });

  it("makes the run incomplete either way, each kept apart", () => {
    const record = {
      ...flowRecord(),
      presses: [{ status: "led" }, { status: "unavailable", reason: "Ratings did not answer." }],
    };
    const failed = { ...flowRecord(), name: "rival", presses: [{ status: "failed", reason: "end not reached" }] };
    expect(problemsOf([record, failed], where).map((problem) => [problem.name, problem.problem])).toEqual([
      ["alerts", "unavailable"],
      ["rival", "failed"],
    ]);
    expect(problemsOf([{ ...flowRecord(), ready: false }], where).map((problem) => problem.problem)).toEqual([
      "not ready",
    ]);
  });
});

describe("a missing control's verdict", () => {
  it("is unavailable only for a live row", () => {
    expect(missingVerdict({ kind: "first-row", live: true })).toEqual({
      status: "unavailable",
      reason: "no first-row on the page",
    });
    expect(missingVerdict({ kind: "tab" })).toEqual({ status: "failed", reason: "not on the page" });
  });
});

describe("a page's layout", () => {
  const holds = (measured, layout) => layoutChecks(measured, layout).map((check) => [check.check, check.ok]);

  it("holds when its content starts under the frame, every word reads at 14 px, and on desktop it starts at the left", () => {
    expect(holds({ contentTop: 24, contentLeft: 32, smallestText: 14 }, "desktop")).toEqual([
      ["content at the top", true],
      ["readable text", true],
      ["no left gutter", true],
    ]);
  });

  it("fails a page moved down under a band or a painting, words drawn smaller than 14 px, and a rail's gutter", () => {
    // A notice band above the body moved the whole body down by 110 px: measured from the frame, it shows.
    expect(holds({ contentTop: 134, contentLeft: 32, smallestText: 14 }, "desktop")[0]).toEqual([
      "content at the top",
      false,
    ]);
    // A 960 px card drawn 358 px wide shows its 16 px words at 6 px.
    expect(holds({ contentTop: 0, contentLeft: 16, smallestText: 6 }, "phone")).toEqual([
      ["content at the top", true],
      ["readable text", false],
    ]);
    const gutter = layoutChecks({ contentTop: 24, contentLeft: 128, smallestText: 14 }, "desktop");
    expect(
      problemsOf([{ ...flowRecord(), name: "lab home play", checks: gutter }], where).map((p) => p.problem),
    ).toEqual(["no left gutter"]);
  });
});

describe("a spectator's way back to play", () => {
  const ORIGIN = 1792060000000.5;
  const played = {
    origin: ORIGIN,
    states: ["app-ready", "app-loading", "app-ready"],
    path: "/g/0xa1/9/map?col=0&row=6",
    chip: "orderslane #4 120 VP",
  };
  const failing = (seen) =>
    watchToPlayChecks(ORIGIN, seen)
      .filter((check) => !check.ok)
      .map((check) => check.check);

  it("holds when the doorway came and went on the same page, and the player plays the game", () => {
    expect(failing(played)).toEqual([]);
  });

  it("fails a reload, which loses what the page kept from the press", () => {
    expect(failing({ ...played, origin: ORIGIN + 9000, states: null })).toEqual([
      "no reload",
      "the doorway shows, then goes",
    ]);
  });

  it("fails a doorway that never goes, as the map step hung before", () => {
    expect(failing({ ...played, states: ["app-ready", "app-loading"] })).toEqual(["the doorway shows, then goes"]);
  });

  it("fails a boot that never left the watched game", () => {
    expect(
      failing({
        ...played,
        states: ["app-ready"],
        path: "/g/0xa1/9/map?spectate=true",
        chip: "Spectating · as orderslane",
      }),
    ).toEqual(["the doorway shows, then goes", "the game played, not watched", "the chip names the player"]);
  });
});
