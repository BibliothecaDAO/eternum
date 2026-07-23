import { describe, expect, it } from "vitest";
import { parseExecutionRecord } from "../../../scripts/settlement/check-a13-sp1-fixture-execution.mjs";

const record = {
  schema: "eternum.a13.sp1-execution-evidence.v1",
  proverInitializationMs: 1,
  suiteElapsedMs: 2,
};

describe("A13 SP1 execution record framing", () => {
  it("parses evidence framed by the libtest status prefix", () => {
    const log = `test mmr_plan_sp1_execution_emits_normative_journal_evidence ... A13_SP1_EXECUTION_EVIDENCE=${JSON.stringify(record)}\nok`;

    expect(parseExecutionRecord(log)).toEqual(record);
  });

  it("still parses an evidence-only line", () => {
    expect(parseExecutionRecord(`A13_SP1_EXECUTION_EVIDENCE=${JSON.stringify(record)}`)).toEqual(record);
  });

  it("rejects duplicate evidence records", () => {
    const framed = `A13_SP1_EXECUTION_EVIDENCE=${JSON.stringify(record)}`;

    expect(() => parseExecutionRecord(`${framed}\n${framed}`)).toThrow(
      "A13 emitted execution record count: expected 1, received 2",
    );
  });
});
