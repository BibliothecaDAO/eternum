import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getArchiveFileName, validateStagedReleaseLayout } from "../../src/release/packager";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("release layout", () => {
  it("builds expected archive filename from target and version", () => {
    expect(getArchiveFileName("linux-x64", "0.1.0")).toBe("eternum-agent-v0.1.0-linux-x64.tar.gz");
  });

  it("fails validation when required files are missing", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "onchain-layout-missing-"));
    tempDirs.push(dir);

    writeFileSync(path.join(dir, "eternum-agent"), "#!/bin/sh\necho ok\n");

    const result = validateStagedReleaseLayout(dir);

    expect(result.ok).toBe(false);
    expect(result.missing).toContain("package.json");
    expect(result.missing).toContain("README.md");
    expect(result.missing).toContain("data/soul.md");
    expect(result.missing).toContain("data/HEARTBEAT.md");
  });

  it("passes validation with required staged files", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "onchain-layout-valid-"));
    tempDirs.push(dir);

    mkdirSync(path.join(dir, "data", "tasks"), { recursive: true });

    writeFileSync(path.join(dir, "eternum-agent"), "#!/bin/sh\necho ok\n");
    writeFileSync(path.join(dir, "package.json"), "{}\n");
    writeFileSync(path.join(dir, "README.md"), "# readme\n");
    writeFileSync(path.join(dir, "LICENSE"), "MIT\n");
    writeFileSync(path.join(dir, ".env.example"), "RPC_URL=http://localhost:5050\n");
    writeFileSync(path.join(dir, "data", "soul.md"), "# Soul\n");
    writeFileSync(path.join(dir, "data", "HEARTBEAT.md"), "version: 1\njobs: []\n");
    writeFileSync(path.join(dir, "data", "tasks", "priorities.md"), "# Priorities\n");

    const result = validateStagedReleaseLayout(dir);
    expect(result.ok).toBe(true);
    expect(result.missing).toEqual([]);
  });
});
