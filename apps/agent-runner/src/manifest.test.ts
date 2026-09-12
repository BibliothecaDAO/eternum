import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createRunManifest, type RunManifestInput } from "./manifest";

const dataDirs: string[] = [];

afterEach(async () => {
  await Promise.all(dataDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

const input = async (): Promise<RunManifestInput> => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "agent-manifest-"));
  dataDirs.push(dataDir);
  return {
    dataDir,
    chain: { chain: "madara", rpcUrl: "https://rpc.example", heraldUrl: "https://herald.example" },
    game: { gameId: 1, gameName: "blitz-fresh-01", mode: "blitz", viewer: "0xabc" },
    model: { profile: "cheap", id: "openai/gpt-4o-mini" },
    startedAt: new Date("2026-09-13T10:00:00.000Z"),
  };
};

const usage = (input: number, output: number, total: number) => ({
  input,
  output,
  cacheRead: 5,
  cacheWrite: 1,
  totalTokens: input + output,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total },
});

describe("run manifest", () => {
  it("accumulates ticks by reason, model usage, and act outcomes by kind and failure class", async () => {
    const manifest = createRunManifest(await input());

    manifest.recordTick("startup", true, "prompted");
    manifest.recordTick("world-delta", false, "skipped");
    manifest.recordTick("world-delta", true, "steered");
    manifest.recordModelCall(usage(100, 20, 0.003));
    manifest.recordModelCall(usage(50, 10, 0.001));
    manifest.recordAction("moveArmy", { kind: "confirmed" });
    manifest.recordAction("moveArmy", { kind: "failed", failureClass: "reverted" });
    manifest.recordAction("armyPaths", { kind: "planned" });
    manifest.recordAction("placeBuilding", { kind: "refused" });

    expect(manifest.snapshot()).toMatchObject({
      schemaVersion: 1,
      runId: "20260913T100000000Z",
      createdAt: "2026-09-13T10:00:00.000Z",
      status: "running",
      stopReason: null,
      loop: {
        ticks: 3,
        byReason: { startup: { woken: 1, actionable: 1 }, "world-delta": { woken: 2, actionable: 1 } },
        deliveries: { prompted: 1, skipped: 1, steered: 1 },
      },
      llm: { calls: 2, tokens: { input: 150, output: 30, cacheRead: 10, cacheWrite: 2 }, costUsd: 0.004 },
      actions: {
        planned: 1,
        attempted: 2,
        confirmed: 1,
        refused: 1,
        failed: 1,
        byKind: { moveArmy: { attempted: 2, confirmed: 1, failed: 1 } },
        failureClasses: { reverted: 1 },
      },
    });
  });

  it("writes runs/<runId>.json through a temp file and reports the stop reason once finished", async () => {
    const source = await input();
    const manifest = createRunManifest(source);

    const written = await manifest.write();
    manifest.finish("max-ticks");
    await manifest.write();

    const runsDir = path.join(source.dataDir, "runs");
    expect(written).toBe(path.join(runsDir, "20260913T100000000Z.json"));
    expect(await readdir(runsDir)).toEqual(["20260913T100000000Z.json"]);
    const stored = JSON.parse(await readFile(written, "utf8"));
    expect(stored).toMatchObject({
      status: "stopped",
      stopReason: "max-ticks",
      runtime: { rssMb: expect.any(Number) },
    });
    expect(stored.endedAt).not.toBeNull();
  });
});
