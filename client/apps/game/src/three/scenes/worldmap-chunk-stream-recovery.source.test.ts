// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("worldmap chunk stream recovery wiring", () => {
  const source = readSource("src/three/scenes/worldmap.tsx");

  it("imports the resubscribe-then-refresh helper", () => {
    expect(source).toContain("runChunkStreamResubscribeThenRefresh");
  });

  it("does not call resubscribe with the fire-and-forget void pattern", () => {
    expect(source).not.toMatch(/void\s+this\.toriiStreamManager\s*\n?\s*\.resubscribe\(\)/);
  });

  it("wires resubscribe into the stall recovery path", () => {
    const start = source.indexOf("private recoverChunkStreamingAfterStall");
    const end = source.indexOf("private recoverAfterConnectionFailure", start);
    const methodSource = source.slice(start, end);
    expect(methodSource).toContain("runChunkStreamResubscribeThenRefresh");
  });
});
