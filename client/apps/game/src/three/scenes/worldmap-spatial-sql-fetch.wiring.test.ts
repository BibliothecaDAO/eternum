// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

const extractRunSpatialSqlFetch = (source: string): string => {
  const start = source.indexOf("  private async runSpatialSqlFetch");
  const end = source.indexOf("  private touchMatrixCache", start);
  return source.slice(start, end);
};

describe("worldmap spatial SQL fetch hardening", () => {
  it("bounds every spatial SQL fetch so background prefetch cannot hold map loading forever", () => {
    const methodSource = extractRunSpatialSqlFetch(readSource("src/three/scenes/worldmap.tsx"));

    expect(methodSource).toContain("settleWorldmapAsyncStage");
    expect(methodSource).toContain("Promise.resolve().then(fetch)");
    expect(methodSource).toContain("WORLDMAP_CHUNK_PHASE_TIMEOUT_MS");
    expect(methodSource).toContain("spatial_sql_fetch_timeout");
  });
});
