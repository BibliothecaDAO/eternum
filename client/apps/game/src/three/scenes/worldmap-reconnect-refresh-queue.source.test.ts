// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/three/scenes/worldmap.tsx"), "utf8");

describe("worldmap reconnect refresh queue wiring", () => {
  it("imports the queue helpers", () => {
    expect(source).toContain("queueOrRunReconnectRefresh");
    expect(source).toContain("drainReconnectRefreshQueue");
    expect(source).toContain("createReconnectRefreshQueueState");
  });

  it("uses queueOrRunReconnectRefresh in refreshAfterReconnect", () => {
    const start = source.indexOf("private refreshAfterReconnect");
    const end = source.indexOf("private drainQueuedReconnectRefresh", start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const methodSource = source.slice(start, end);
    expect(methodSource).toContain("queueOrRunReconnectRefresh");
  });

  it("drains the queue in the chunk transition success path", () => {
    expect(source).toMatch(/drainQueuedReconnectRefresh\(\)/);
    expect(source).not.toContain("hasPendingRefresh: undefined");
  });
});
