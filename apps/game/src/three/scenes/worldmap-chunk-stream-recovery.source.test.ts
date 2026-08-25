// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("worldmap chunk stream recovery wiring", () => {
  const source = readSource("src/three/scenes/worldmap.tsx");

  it("does not depend on the legacy bounded stream resubscribe helper", () => {
    expect(source).not.toContain("runChunkStreamResubscribeThenRefresh");
  });

  it("has no camera-owned Torii stream manager", () => {
    expect(source).not.toContain("toriiStreamManager");
  });

  it("schedules a local projection refresh without resubscribing", () => {
    const start = source.indexOf("private recoverChunkStreamingAfterStall");
    const end = source.indexOf("private recoverAfterConnectionFailure", start);
    const methodSource = source.slice(start, end);
    expect(methodSource).toContain("scheduleChunkRecoveryWithReason");
    expect(methodSource).not.toContain(".resubscribe()");
  });
});
