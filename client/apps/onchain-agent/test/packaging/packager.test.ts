import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import { runReleasePackaging } from "../../src/release/packager";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("release packaging", () => {
  it("packages a linux artifact and writes checksums in skip-build mode", async () => {
    const workspace = mkdtempSync(path.join(tmpdir(), "onchain-packager-"));
    tempDirs.push(workspace);

    const packageDir = path.join(workspace, "package");
    mkdirSync(path.join(packageDir, "data", "tasks"), { recursive: true });

    const binaryPath = path.join(workspace, "axis-bin");
    writeFileSync(binaryPath, "#!/bin/sh\necho agent\n");

    writeFileSync(
      path.join(packageDir, "package.json"),
      JSON.stringify({ name: "@bibliothecadao/onchain-agent", version: "0.1.0" }),
    );
    writeFileSync(path.join(packageDir, "README.md"), "# agent\n");
    writeFileSync(path.join(packageDir, ".env.example"), "RPC_URL=http://localhost:5050\n");
    writeFileSync(path.join(packageDir, "data", "soul.md"), "# Soul\n");
    writeFileSync(path.join(packageDir, "data", "HEARTBEAT.md"), "version: 1\njobs: []\n");
    writeFileSync(path.join(packageDir, "data", "tasks", "priorities.md"), "# Priorities\n");

    const licensePath = path.join(workspace, "LICENSE");
    writeFileSync(licensePath, "MIT\n");

    const outputDir = path.join(workspace, "out");

    const result = await runReleasePackaging({
      packageDir,
      outputDir,
      targets: ["linux-x64"],
      version: "0.1.0",
      skipBuild: true,
      binaryPath,
      licensePath,
    });

    expect(result.archives).toHaveLength(1);
    expect(result.archives[0]).toContain("axis-v0.1.0-linux-x64.tar.gz");

    const checksumsPath = path.join(outputDir, "checksums.txt");
    const checksums = readFileSync(checksumsPath, "utf8");
    expect(checksums).toContain("axis-v0.1.0-linux-x64.tar.gz");

    const archivePath = result.archives[0];
    const listing = execFileSync("tar", ["-tzf", archivePath], { encoding: "utf8" });
    expect(listing).toContain("axis/axis");
    expect(listing).toContain("axis/package.json");
    expect(listing).toContain("axis/data/soul.md");
    expect(listing).toContain("axis/data/HEARTBEAT.md");
  });
});
