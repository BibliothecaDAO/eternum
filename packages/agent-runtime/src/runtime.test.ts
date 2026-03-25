import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  FileSystemAgentArtifactStore,
  loadAgentArtifacts,
  materializeAgentArtifacts,
  runWorldActionBatch,
} from "./index";

describe("agent runtime helpers", () => {
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
});
