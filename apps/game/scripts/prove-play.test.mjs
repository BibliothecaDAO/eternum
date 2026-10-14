import { describe, expect, it } from "vitest";

import { judge, problemsOf } from "./prove-play.mjs";

const BASE = "https://127.0.0.1:4176";

describe("a press's verdict", () => {
  it("counts a press as led only where its verb leads", () => {
    expect(judge("Watch", `${BASE}/`, `${BASE}/g/0xa/3?spectate=true`)).toMatchObject({ status: "led" });
    expect(judge("Lobby", `${BASE}/`, `${BASE}/blitz/game-0xa-8`)).toMatchObject({ status: "led" });
    expect(judge("Play free", `${BASE}/`, `${BASE}/sign-in?next=%2Fg%2F0xa%2F1`)).toMatchObject({
      status: "led",
      led: "/sign-in?next=/g/0xa/1",
    });
  });

  it("fails a press that goes nowhere or somewhere its verb does not lead", () => {
    expect(judge("Join", `${BASE}/`, `${BASE}/`)).toMatchObject({ status: "failed", reason: "no navigation" });
    expect(judge("Enter", `${BASE}/`, `${BASE}/g/0xa/3?spectate=true`)).toMatchObject({
      status: "failed",
      reason: "unexpected destination",
    });
  });
});

describe("the run's completeness", () => {
  const led = { word: "Join", status: "led", led: "/blitz/slot-1" };
  const record = (over) => ({ state: "live", layout: "phone", ready: true, presses: [[led]], ...over });

  it("is complete only when every page was ready and every press led", () => {
    expect(problemsOf([record({})])).toEqual([]);
  });

  it("lists a page that never became ready, a press whose row was gone, and a press that failed", () => {
    const problems = problemsOf([
      record({ ready: false, presses: [] }),
      record({ presses: [[led, { word: "Sign in", status: "unavailable" }]] }),
      record({ presses: [[{ word: "Watch", status: "failed", reason: "no navigation" }]] }),
    ]);
    expect(problems.map((problem) => problem.problem)).toEqual(["not ready", "unavailable", "failed"]);
  });
});
