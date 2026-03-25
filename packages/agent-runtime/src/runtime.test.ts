import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  FileSystemAgentArtifactStore,
  loadAgentArtifacts,
  materializeAgentArtifacts,
  runAgentTurn,
  runWorldActionBatch,
} from "./index";

describe("agent runtime helpers", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("loads and materializes artifacts from the filesystem store", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "agent-runtime-store-"));
    const store = new FileSystemAgentArtifactStore(rootDir);

    await store.save({
      agentId: "agent-1",
      files: {
        "memory.md": "hello",
      },
    });

    const artifacts = await loadAgentArtifacts({
      agentId: "agent-1",
      store,
      files: ["memory.md"],
    });
    const materializedDir = await mkdtemp(join(tmpdir(), "agent-runtime-materialized-"));
    await materializeAgentArtifacts({
      dataDir: materializedDir,
      artifacts,
    });

    expect(await readFile(join(materializedDir, "memory.md"), "utf8")).toBe("hello");
  });

  it("tracks successes and failures when running action batches", async () => {
    const result = await runWorldActionBatch({
      actions: [1, 2, 3],
      execute: async (value) => {
        if (value === 2) {
          throw new Error("boom");
        }
        return value * 2;
      },
    });

    expect(result.total).toBe(3);
    expect(result.succeeded).toBe(2);
    expect(result.failed).toBe(1);
  });

  it("fails a turn when prompt execution exceeds the configured timeout", async () => {
    vi.useFakeTimers();

    const resultPromise = runAgentTurn({
      runtime: {
        dataDir: "/tmp/agent-runtime/agent-1",
        isBusy: () => false,
        prompt: () => new Promise(() => undefined),
        followUp: () => undefined,
        reloadPrompt: () => undefined,
        emit: () => undefined,
        onEvent: () => () => undefined,
        dispose: async () => undefined,
      },
      prompt: "Take the next turn.",
      timeoutMs: 500,
      wakeReason: "scheduled_tick",
    });

    await vi.advanceTimersByTimeAsync(500);
    const result = await resultPromise;

    expect(result.success).toBe(false);
    expect(result.errorMessage).toBe("Turn timed out after 500ms.");
    expect(result.wakeReason).toBe("scheduled_tick");
  });
});
