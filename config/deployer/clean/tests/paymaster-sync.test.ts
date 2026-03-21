import * as fs from "node:fs";
import { afterAll, afterEach, describe, expect, mock, test } from "bun:test";
import { resolveRepoPath } from "../shared/repo";

const spawnSyncMock = mock(() => ({
  status: 0,
  stdout: "",
  stderr: "",
  error: undefined,
}));

mock.module("node:child_process", () => ({
  spawnSync: spawnSyncMock,
}));

const { syncPaymasterPolicy } = await import("../paymaster");

const originalFetch = globalThis.fetch;
const originalStdoutWrite = process.stdout.write.bind(process.stdout);
const originalStderrWrite = process.stderr.write.bind(process.stderr);
const outputPath = resolveRepoPath(".context/paymaster/eternum-actions-mainnet-alpha.json");

afterEach(() => {
  globalThis.fetch = originalFetch;
  process.stdout.write = originalStdoutWrite as typeof process.stdout.write;
  process.stderr.write = originalStderrWrite as typeof process.stderr.write;
  spawnSyncMock.mockClear();

  if (fs.existsSync(outputPath)) {
    fs.unlinkSync(outputPath);
  }
});

afterAll(() => {
  mock.restore();
});

describe("syncPaymasterPolicy", () => {
  test("writes actions in dry-run mode without applying the policy", async () => {
    const applyPolicy = () => {
      throw new Error("applyPolicy should not run during dry runs");
    };

    globalThis.fetch = async (url) => {
      const decodedUrl = decodeURIComponent(String(url));

      if (decodedUrl.includes("[wf-WorldContract]")) {
        return Response.json([
          {
            contract_address: "0x123",
            contract_selector: "0x1",
          },
        ]);
      }

      if (decodedUrl.includes("[wf-WorldDeployed]")) {
        return Response.json([
          {
            world_address: "0xworld",
          },
        ]);
      }

      throw new Error(`Unexpected fetch call: ${String(url)}`);
    };

    const result = await syncPaymasterPolicy({
      chain: "mainnet",
      gameName: "alpha",
      dryRun: true,
      vrfProviderAddress: "0x456",
      applyPolicy,
    });

    expect(result.chain).toBe("mainnet");
    expect(result.gameName).toBe("alpha");
    expect(result.dryRun).toBe(true);
    expect(result.updated).toBe(false);
    expect(result.actionCount).toBeGreaterThan(0);
    expect(result.outputPath).toBe(outputPath);
    expect(fs.existsSync(result.outputPath)).toBe(true);
  });

  test("applies the policy when not running in dry-run mode", async () => {
    const applyPolicyCalls: Array<{ paymasterName: string; filePath: string }> = [];

    globalThis.fetch = async (url) => {
      const decodedUrl = decodeURIComponent(String(url));

      if (decodedUrl.includes("[wf-WorldContract]")) {
        return Response.json([
          {
            contract_address: "0x123",
            contract_selector: "0x1",
          },
        ]);
      }

      if (decodedUrl.includes("[wf-WorldDeployed]")) {
        return Response.json([
          {
            world_address: "0xworld",
          },
        ]);
      }

      throw new Error(`Unexpected fetch call: ${String(url)}`);
    };

    const result = await syncPaymasterPolicy({
      chain: "mainnet",
      gameName: "alpha",
      vrfProviderAddress: "0x456",
      applyPolicy: (paymasterName, filePath) => {
        applyPolicyCalls.push({ paymasterName, filePath });
      },
    });

    expect(result.updated).toBe(true);
    expect(applyPolicyCalls).toEqual([
      {
        paymasterName: "empire",
        filePath: outputPath,
      },
    ]);
  });

  test("captures slot CLI output instead of inheriting workflow stdio", async () => {
    const stdoutWrites: string[] = [];
    const stderrWrites: string[] = [];

    process.stdout.write = ((chunk: string | Uint8Array) => {
      stdoutWrites.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;
    process.stderr.write = ((chunk: string | Uint8Array) => {
      stderrWrites.push(String(chunk));
      return true;
    }) as typeof process.stderr.write;

    spawnSyncMock.mockReturnValue({
      status: 0,
      stdout: "slot ok",
      stderr: "slot warning",
      error: undefined,
    });

    globalThis.fetch = async (url) => {
      const decodedUrl = decodeURIComponent(String(url));

      if (decodedUrl.includes("[wf-WorldContract]")) {
        return Response.json([
          {
            contract_address: "0x123",
            contract_selector: "0x1",
          },
        ]);
      }

      if (decodedUrl.includes("[wf-WorldDeployed]")) {
        return Response.json([
          {
            world_address: "0xworld",
          },
        ]);
      }

      throw new Error(`Unexpected fetch call: ${String(url)}`);
    };

    await syncPaymasterPolicy({
      chain: "mainnet",
      gameName: "alpha",
      vrfProviderAddress: "0x456",
    });

    expect(spawnSyncMock).toHaveBeenCalledTimes(1);
    expect(spawnSyncMock.mock.calls[0]).toEqual([
      "slot",
      ["paymaster", "empire", "policy", "add-from-json", "--file", outputPath],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        maxBuffer: 10 * 1024 * 1024,
      },
    ]);
    expect(stdoutWrites).toEqual(["slot ok\n"]);
    expect(stderrWrites).toEqual(["slot warning\n"]);
  });
});
