import { afterEach, expect, test } from "bun:test";
import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { now } from "./common";
import { waitForLastReceipt, waitForNonemptyClose } from "./follow-up-release";
const directories: string[] = [];
function file(name: string) {
  const directory = mkdtempSync(join(tmpdir(), "spike-followup-"));
  directories.push(directory);
  return join(directory, name);
}
afterEach(() => directories.splice(0).forEach((directory) => rmSync(directory, { recursive: true })));

test("a late checkpoint preserves the requested target instead of relabelling arrival as zero offset", async () => {
  const path = file("checkpoint.json"),
    observed = now() - 1000000000n;
  writeFileSync(path, JSON.stringify({ completed: 2000, lastReceiptNs: String(observed) }));
  const trigger = await waitForLastReceipt(path, 250, 1000);
  expect(trigger.observedNs).toBe(String(observed));
  expect(BigInt(trigger.targetNs) - observed).toBe(250000000n);
  expect(now() - BigInt(trigger.targetNs)).toBeGreaterThan(700000000n);
});

test("an incomplete burst cannot release its follow-up", async () => {
  const path = file("checkpoint.json");
  writeFileSync(path, JSON.stringify({ completed: 1999, lastReceiptNs: String(now()) }));
  await expect(waitForLastReceipt(path, 0, 1000)).rejects.toThrow("did not complete");
});

test("a missing checkpoint times out without a fabricated primary completion", async () => {
  await expect(waitForLastReceipt(file("missing.json"), 0, 5)).rejects.toThrow("deadline");
});

test("close-start trigger ignores idle seals and requires a matching executed nonempty batch", async () => {
  const path = file("node.log");
  writeFileSync(path, "");
  const trigger = await waitForNonemptyClose(path, 1000, () => {
    appendFileSync(
      path,
      "received_executor_batch_executed block_number=12 txs_added_to_block=0\nclose_block_worker_started block_number=12\nreceived_executor_batch_executed block_number=13 txs_added_to_block=24\nclose_block_worker_started block_number=13\n",
    );
  });
  expect(trigger.block).toBe(13);
  expect(trigger.kind).toBe("observed nonempty close worker start");
});
