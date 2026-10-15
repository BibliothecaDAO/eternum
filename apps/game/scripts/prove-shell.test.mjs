import { describe, expect, it } from "vitest";

import { problemsOf } from "./prove-run.mjs";
import { changingSetting, stopVerdict } from "./prove-shell.mjs";

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

describe("a flow that stops short", () => {
  it("is unavailable when the page names a service that did not answer, or the live data holds no such row", () => {
    expect(stopVerdict({ kind: "press" }, ["Ratings did not answer."], "end not reached")).toEqual({
      status: "unavailable",
      reason: "Ratings did not answer.",
    });
    expect(stopVerdict({ kind: "finished-game", live: true }, [], "not on the page")).toEqual({
      status: "unavailable",
      reason: "no finished-game on the page",
    });
  });

  it("failed when the page answered and the control or the end is still not there", () => {
    expect(stopVerdict({ kind: "tab" }, [], "not on the page")).toEqual({
      status: "failed",
      reason: "not on the page",
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
