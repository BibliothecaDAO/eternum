import { describe, expect, it } from "vitest";

import { CONNECT, destinationOf, judge, playRecordWhere } from "./prove-play.mjs";
import { problemsOf } from "./prove-run.mjs";

const BASE = "https://127.0.0.1:4176";

describe("where a press must lead", () => {
  it("is the item's own game or results", () => {
    expect(destinationOf("Watch", { item: "game:0xa:3" })).toBe("/g/0xa/3?spectate=true");
    expect(destinationOf("Enter", { item: "game:0xa:3" })).toBe("/g/0xa/3");
    expect(destinationOf("Resume", { item: "0xa:1" })).toBe("/g/0xa/1");
    expect(destinationOf("Play free", { item: "0xa:1" })).toBe(CONNECT);
    expect(destinationOf("Results", { item: "0xa:7" })).toBe("/results/0xa-7");
  });

  it("is Connect over the page a Sign in was pressed from", () => {
    expect(destinationOf("Sign in", { from: "/season" })).toBe(CONNECT);
  });

  it("is unknown for a word the proof does not know", () => {
    expect(destinationOf("Spin", { item: "0xa:1" })).toBeNull();
  });
});

describe("a press's verdict", () => {
  const watchThree = destinationOf("Watch", { item: "game:0xa:3" });

  it("counts a press as led only at its own game's address", () => {
    expect(judge("Watch", watchThree, `${BASE}/`, `${BASE}/g/0xa/3?spectate=true`)).toEqual({
      word: "Watch",
      status: "led",
      expected: "/g/0xa/3?spectate=true",
      led: "/g/0xa/3?spectate=true",
    });
    expect(judge("Play free", CONNECT, `${BASE}/`, `${BASE}/`, true)).toMatchObject({ status: "led", led: CONNECT });
  });

  it("fails a press that opens another game with the same verb", () => {
    expect(judge("Watch", watchThree, `${BASE}/`, `${BASE}/g/0xa/2?spectate=true`)).toMatchObject({
      status: "failed",
      reason: "unexpected destination",
    });
    expect(judge("Watch", watchThree, `${BASE}/`, `${BASE}/g/wrong-world/999/map?spectate=true`)).toMatchObject({
      status: "failed",
      reason: "unexpected destination",
    });
  });

  it("fails a Sign in that leaves its page, or opens no Connect window", () => {
    const expected = destinationOf("Sign in", { from: "/season" });
    const page = `${BASE}/season`;
    expect(judge("Sign in", expected, page, `${BASE}/`, true)).toMatchObject({
      status: "failed",
      reason: "left the page instead of opening Connect",
    });
    expect(judge("Sign in", expected, page, page, false)).toMatchObject({
      status: "failed",
      reason: "Connect did not open",
    });
  });

  it("fails a press that goes nowhere, or whose word has no known address", () => {
    expect(judge("Enter", "/g/0xa/1", `${BASE}/`, `${BASE}/`)).toMatchObject({
      status: "failed",
      reason: "no navigation",
    });
    expect(judge("Spin", null, `${BASE}/`, `${BASE}/g/0xa/1`)).toMatchObject({
      status: "failed",
      reason: "no known destination",
    });
  });
});

describe("the run's completeness", () => {
  const led = { word: "Enter", status: "led", led: "/g/0xa/1" };
  const record = (over) => ({ state: "live", layout: "phone", ready: true, presses: [[led]], ...over });

  it("is complete only when every page was ready and every press led", () => {
    expect(problemsOf([record({})], playRecordWhere)).toEqual([]);
  });

  it("lists a page that never became ready, a press whose row was gone, and a press that failed", () => {
    const problems = problemsOf(
      [
        record({ ready: false, presses: [] }),
        record({ presses: [[led, { word: "Sign in", status: "unavailable" }]] }),
        record({ presses: [[{ word: "Watch", status: "failed", reason: "no navigation" }]] }),
      ],
      playRecordWhere,
    );
    expect(problems.map((problem) => problem.problem)).toEqual(["not ready", "unavailable", "failed"]);
  });
});
