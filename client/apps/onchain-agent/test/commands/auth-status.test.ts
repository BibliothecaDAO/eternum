import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { writeArtifacts } from "../../src/session/artifacts";

// Mock controller session to avoid actual Cartridge SDK dependency
vi.mock("../../src/session/controller-session", () => ({
  ControllerSession: class {
    async probe() {
      return null;
    }
  },
  buildSessionPoliciesFromManifest: vi.fn().mockReturnValue({ contracts: {} }),
}));

// Mock config to point to our temp dir
let tmpDir: string;
vi.mock("../../src/config", () => ({
  loadConfig: () => ({
    sessionBasePath: tmpDir,
    rpcUrl: "http://localhost:5050",
    chainId: "0x4b4154414e41",
    gameName: "eternum",
  }),
}));

import { runAuthStatus } from "../../src/commands/auth-status";

describe("axis auth-status", () => {
  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), "axis-auth-status-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns none for non-existent world", async () => {
    const output: string[] = [];
    const code = await runAuthStatus({
      world: "nonexistent",
      all: false,
      json: true,
      write: (s) => output.push(s),
    });
    expect(code).toBe(0);
    const parsed = JSON.parse(output.join(""));
    expect(parsed.status).toBe("none");
  });

  it("returns pending for world with pending auth", async () => {
    writeArtifacts(path.join(tmpDir, "test-world"), {
      profile: {
        name: "test-world",
        chain: "slot",
        toriiBaseUrl: "",
        worldAddress: "0x1",
        contractsBySelector: {},
        fetchedAt: 0,
      },
      manifest: { contracts: [] },
      policy: { contracts: {} },
      auth: {
        url: "https://auth.example.com",
        status: "pending",
        worldName: "test-world",
        chain: "slot",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    });

    const output: string[] = [];
    const code = await runAuthStatus({
      world: "test-world",
      all: false,
      json: true,
      write: (s) => output.push(s),
    });
    expect(code).toBe(0);
    const parsed = JSON.parse(output.join(""));
    expect(parsed.status).toBe("pending");
  });

  it("lists all worlds with --all", async () => {
    writeArtifacts(path.join(tmpDir, "world-a"), {
      profile: {
        name: "world-a",
        chain: "slot",
        toriiBaseUrl: "",
        worldAddress: "0x1",
        contractsBySelector: {},
        fetchedAt: 0,
      },
      manifest: { contracts: [] },
      policy: { contracts: {} },
      auth: { url: "", status: "pending", worldName: "world-a", chain: "slot", createdAt: "" },
    });
    writeArtifacts(path.join(tmpDir, "world-b"), {
      profile: {
        name: "world-b",
        chain: "sepolia",
        toriiBaseUrl: "",
        worldAddress: "0x2",
        contractsBySelector: {},
        fetchedAt: 0,
      },
      manifest: { contracts: [] },
      policy: { contracts: {} },
      auth: { url: "", status: "pending", worldName: "world-b", chain: "sepolia", createdAt: "" },
    });

    const output: string[] = [];
    const code = await runAuthStatus({
      all: true,
      json: true,
      write: (s) => output.push(s),
    });
    expect(code).toBe(0);
    const parsed = JSON.parse(output.join(""));
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(2);
  });

  it("requires world name or --all", async () => {
    const output: string[] = [];
    const code = await runAuthStatus({
      all: false,
      json: true,
      write: (s) => output.push(s),
    });
    expect(code).toBe(1);
    const parsed = JSON.parse(output.join(""));
    expect(parsed.error).toBeDefined();
  });
});
