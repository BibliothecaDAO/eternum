import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readArmyManagerSource(): string {
  const managersDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(managersDir, "army-manager.ts"), "utf8");
}

describe("army manager performance instrumentation", () => {
  it("tracks explicit army chunk render phases in the source", () => {
    const source = readArmyManagerSource();

    expect(source).toContain('PerformanceMonitor.begin("armyChunk.total")');
    expect(source).toContain('PerformanceMonitor.begin("armyChunk.preloadModels")');
    expect(source).toContain('PerformanceMonitor.begin("armyChunk.reconcile")');
    expect(source).toContain('PerformanceMonitor.begin("armyChunk.attachments")');
    expect(source).toContain('PerformanceMonitor.begin("armyChunk.upload")');
    expect(source).toContain('PerformanceMonitor.begin("armyFrame.total")');
    expect(source).toContain('PerformanceMonitor.begin("armyFrame.modelAnimation")');
    expect(source).toContain('PerformanceMonitor.begin("armyFrame.batchedVisible")');
    expect(source).toContain('PerformanceMonitor.begin("armyFrame.labelVisibility")');
  });
});
