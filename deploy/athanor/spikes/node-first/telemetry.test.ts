import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { executorLogs } from "./telemetry";

describe("node close evidence", () => {
  test("counts the actual close once when DEBUG includes its completion delivery", () => {
    const directory = mkdtempSync(join(tmpdir(), "spike-evidence-"));
    try {
      const file = join(directory, "node.log");
      const earlier = JSON.stringify({ message: "close_block_complete", tx_count: 1 }) + "\n";
      writeFileSync(
        file,
        earlier +
          [
            JSON.stringify({
              message: "received_executor_batch_executed txs_executed_in_batch=500 batch_exec_duration_ms=25",
            }),
            JSON.stringify({ message: "close_block_complete", tx_count: 500 }),
            JSON.stringify({ message: "close_block_complete block_number=2 queue_depth=0" }),
            "partial collector line",
          ].join("\n"),
      );
      const evidence = executorLogs(file, earlier.length);
      expect(evidence.blocksClosed).toBe(1);
      expect(evidence.batches).toMatchObject([{ size: 500, executionMs: 25 }]);
      expect(evidence.unavailable).toBe(false);
    } finally {
      rmSync(directory, { recursive: true });
    }
  });
});
