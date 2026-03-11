import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { writeArtifacts, readArtifacts, readAuthStatus, updateAuthStatus } from "../../src/session/artifacts";

describe("artifacts", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), "axis-artifacts-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("writes profile, manifest, policy, and auth to world dir", () => {
    const worldDir = path.join(tmpDir, "test-world");
    writeArtifacts(worldDir, {
      profile: {
        name: "test-world",
        chain: "slot",
        toriiBaseUrl: "http://example.com",
        rpcUrl: "http://rpc",
        worldAddress: "0x1",
        contractsBySelector: {},
        fetchedAt: 1000,
      },
      manifest: { contracts: [{ tag: "test", address: "0x2" }] },
      policy: { contracts: { "0x2": { methods: [{ name: "test", entrypoint: "test" }] } } },
      auth: {
        url: "https://auth.example.com",
        status: "pending",
        worldName: "test-world",
        chain: "slot",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    });

    const profile = JSON.parse(readFileSync(path.join(worldDir, "profile.json"), "utf-8"));
    expect(profile.name).toBe("test-world");

    const manifest = JSON.parse(readFileSync(path.join(worldDir, "manifest.json"), "utf-8"));
    expect(manifest.contracts).toHaveLength(1);

    const policy = JSON.parse(readFileSync(path.join(worldDir, "policy.json"), "utf-8"));
    expect(policy.contracts["0x2"]).toBeDefined();

    const auth = JSON.parse(readFileSync(path.join(worldDir, "auth.json"), "utf-8"));
    expect(auth.status).toBe("pending");
  });

  it("reads artifacts back from world dir", () => {
    const worldDir = path.join(tmpDir, "test-world");
    writeArtifacts(worldDir, {
      profile: {
        name: "test-world",
        chain: "slot",
        toriiBaseUrl: "http://example.com",
        rpcUrl: "http://rpc",
        worldAddress: "0x1",
        contractsBySelector: {},
        fetchedAt: 1000,
      },
      manifest: { contracts: [{ tag: "test", address: "0x2" }] },
      policy: { contracts: {} },
      auth: {
        url: "https://auth.example.com",
        status: "pending",
        worldName: "test-world",
        chain: "slot",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    });

    const read = readArtifacts(worldDir);
    expect(read.profile.name).toBe("test-world");
    expect(read.manifest.contracts).toHaveLength(1);
    expect(read.auth.status).toBe("pending");
  });

  it("reads auth status from existing dir", () => {
    const worldDir = path.join(tmpDir, "test-world");
    writeArtifacts(worldDir, {
      profile: {
        name: "w",
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
        status: "active",
        worldName: "w",
        chain: "slot",
        createdAt: "2026-01-01T00:00:00.000Z",
        address: "0xabc",
      },
    });

    const status = readAuthStatus(worldDir);
    expect(status.status).toBe("active");
    expect(status.address).toBe("0xabc");
  });

  it("returns status none when dir does not exist", () => {
    const status = readAuthStatus(path.join(tmpDir, "nonexistent"));
    expect(status.status).toBe("none");
  });

  it("updates auth status in place", () => {
    const worldDir = path.join(tmpDir, "test-world");
    writeArtifacts(worldDir, {
      profile: {
        name: "w",
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
        worldName: "w",
        chain: "slot",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    });

    updateAuthStatus(worldDir, { status: "active", address: "0xdef" });

    const updated = readAuthStatus(worldDir);
    expect(updated.status).toBe("active");
    expect(updated.address).toBe("0xdef");
    expect(updated.url).toBe("https://auth.example.com");
  });
});
