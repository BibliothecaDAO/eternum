import { chmodSync, existsSync, lstatSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";

const tempDirs: string[] = [];

function createTempDir(prefix: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function sha256(filePath: string): string {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function createReleaseFixture(
  baseDir: string,
  version: string,
  target: string,
  checksumMode: "valid" | "invalid",
): void {
  const resolvedVersion = version.replace(/^v/, "");
  const versionDir = path.join(baseDir, version);
  const stageRoot = path.join(baseDir, "stage");
  const stageDir = path.join(stageRoot, "eternum-agent");
  mkdirSync(stageDir, { recursive: true });

  const binaryPath = path.join(stageDir, "eternum-agent");
  writeFileSync(
    binaryPath,
    `#!/bin/sh
if [ "$1" = "--version" ]; then
  echo "${resolvedVersion}"
  exit 0
fi
echo "mock-agent"
`,
    "utf8",
  );
  chmodSync(binaryPath, 0o755);

  mkdirSync(versionDir, { recursive: true });

  const archiveName = `eternum-agent-v${version.replace(/^v/, "")}-${target}.tar.gz`;
  const archivePath = path.join(versionDir, archiveName);
  execFileSync("tar", ["-czf", archivePath, "-C", stageRoot, "eternum-agent"]);

  const expectedHash = checksumMode === "valid" ? sha256(archivePath) : "deadbeef";
  writeFileSync(path.join(versionDir, "checksums.txt"), `${expectedHash}  ${archiveName}\n`, "utf8");
}

function runInstaller(env: NodeJS.ProcessEnv): { stdout: string; stderr: string } {
  const scriptPath = path.resolve(process.cwd(), "../../../scripts/install-onchain-agent.sh");
  expect(existsSync(scriptPath)).toBe(true);

  const stdout = execFileSync("bash", [scriptPath], {
    env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  return { stdout, stderr: "" };
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe("install-onchain-agent.sh", () => {
  it("installs pinned version from a local release fixture", () => {
    const workspace = createTempDir("onchain-install-pinned-");
    const releasesRoot = path.join(workspace, "releases");
    const installDir = path.join(workspace, "install");
    const binDir = path.join(workspace, "bin");

    createReleaseFixture(releasesRoot, "v0.1.0", "linux-x64", "valid");

    const env = {
      ...process.env,
      VERSION: "v0.1.0",
      TARGET: "linux-x64",
      RELEASE_BASE_URL: `file://${releasesRoot}`,
      INSTALL_DIR: installDir,
      BIN_DIR: binDir,
    };

    runInstaller(env);

    const linkedBinary = path.join(binDir, "eternum-agent");
    expect(existsSync(linkedBinary)).toBe(true);
    expect(lstatSync(linkedBinary).isSymbolicLink()).toBe(true);

    const versionOutput = execFileSync(linkedBinary, ["--version"], { encoding: "utf8" }).trim();
    expect(versionOutput).toBe("0.1.0");
  });

  it("installs latest version when VERSION is not set", () => {
    const workspace = createTempDir("onchain-install-latest-");
    const releasesRoot = path.join(workspace, "releases");
    const installDir = path.join(workspace, "install");
    const binDir = path.join(workspace, "bin");

    createReleaseFixture(releasesRoot, "v0.2.0", "linux-x64", "valid");
    writeFileSync(path.join(workspace, "latest.json"), JSON.stringify({ tag_name: "v0.2.0" }), "utf8");

    const env = {
      ...process.env,
      TARGET: "linux-x64",
      RELEASE_BASE_URL: `file://${releasesRoot}`,
      LATEST_VERSION_URL: `file://${path.join(workspace, "latest.json")}`,
      INSTALL_DIR: installDir,
      BIN_DIR: binDir,
    };

    runInstaller(env);

    const linkedBinary = path.join(binDir, "eternum-agent");
    const versionOutput = execFileSync(linkedBinary, ["--version"], { encoding: "utf8" }).trim();
    expect(versionOutput).toBe("0.2.0");
  });

  it("fails fast when checksum does not match", () => {
    const workspace = createTempDir("onchain-install-bad-checksum-");
    const releasesRoot = path.join(workspace, "releases");

    createReleaseFixture(releasesRoot, "v0.1.0", "linux-x64", "invalid");

    const scriptPath = path.resolve(process.cwd(), "../../../scripts/install-onchain-agent.sh");

    let stderr = "";
    try {
      execFileSync("bash", [scriptPath], {
        env: {
          ...process.env,
          VERSION: "v0.1.0",
          TARGET: "linux-x64",
          RELEASE_BASE_URL: `file://${releasesRoot}`,
          INSTALL_DIR: path.join(workspace, "install"),
          BIN_DIR: path.join(workspace, "bin"),
        },
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
      throw new Error("installer unexpectedly succeeded");
    } catch (error) {
      const err = error as { stderr?: string };
      stderr = err.stderr ?? "";
    }

    expect(stderr).toContain("Checksum mismatch");
  });
});
