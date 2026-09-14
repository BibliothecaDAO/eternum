#!/usr/bin/env bun
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { promisify } from "node:util";

async function main() {
  const [fixturePath, placement, destination] = process.argv.slice(2);
  if (!fixturePath || !destination || !["sidecar", "embedded"].includes(placement))
    throw new Error("usage: check-herald.ts FIXTURE_JSON PLACEMENT OUTPUT_DIRECTORY");
  const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
  assert.equal(fixture.rpc, "http://127.0.0.1:15050/rpc/v0_9_0");
  const game = BigInt(fixture.game).toString();
  const output = resolve(destination);
  mkdirSync(output);
  const messages: { elapsed_ms: number; epoch_ms: number; message: Record<string, unknown> }[] = [];
  const started = performance.now();
  const socket = new WebSocket(`ws://127.0.0.1:13003/madara/games/${game}`);
  let ready = false;
  let failure: Error | undefined;
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(String(data));
    messages.push({
      elapsed_ms: performance.now() - started,
      epoch_ms: performance.timeOrigin + performance.now(),
      message,
    });
    if (message.type === "hello") socket.send(JSON.stringify({ type: "resume", epoch: "", seq: 0 }));
    if (message.type === "snapshot_end") ready = true;
  };
  socket.onerror = () => {
    failure = new Error("Herald stream failed");
  };
  socket.onclose = () => {
    failure ??= new Error("Herald stream closed before observation completed");
  };
  try {
    const deadline = Date.now() + 30_000;
    while (!ready && !failure && Date.now() < deadline) await sleep(10);
    if (failure) throw failure;
    assert(ready, "Herald did not complete its initial snapshot");
    const child = await promisify(execFile)(
      "bun",
      [
        resolve(import.meta.dirname, "exercise-fixture.ts"),
        resolve(fixturePath),
        resolve(output, "admission.json"),
        placement,
      ],
      { timeout: 60_000 },
    );
    writeFileSync(resolve(output, "admission.log"), child.stdout + child.stderr, { flag: "wx" });
    const result = JSON.parse(readFileSync(resolve(output, "admission.json"), "utf8"));
    const expectedNonce = BigInt(result.order);
    const rowDeadline = Date.now() + 10_000;
    const delivery = () =>
      messages.find(
        ({ message }) =>
          message.type === "diff" &&
          message.preconfirmed === true &&
          Array.isArray(message.set) &&
          message.set.some(
            (row: { model: string; value: { nonce?: string } }) =>
              row.model === "ActionNonce" && row.value.nonce !== undefined && BigInt(row.value.nonce) === expectedNonce,
          ),
      );
    while (!delivery() && !failure && Date.now() < rowDeadline) await sleep(10);
    if (failure) throw failure;
    assert(delivery(), "Accepted result did not arrive as a pre-confirmed ActionNonce diff");
    writeFileSync(
      resolve(output, "report.json"),
      JSON.stringify(
        {
          schema: 1,
          scope: "conformance row delivery; not explore or latency-budget evidence",
          placement,
          action: result.action,
          order: result.order,
          submission_to_preconfirmed_row_ms: delivery()!.epoch_ms - result.submissionEpochMs,
          delivery: delivery(),
          messages,
        },
        null,
        2,
      ) + "\n",
      { flag: "wx" },
    );
  } finally {
    socket.onclose = null;
    socket.close();
    writeFileSync(resolve(output, "stream.json"), JSON.stringify(messages, null, 2) + "\n", { flag: "wx" });
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
