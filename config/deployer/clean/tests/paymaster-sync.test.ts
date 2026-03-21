import * as fs from "node:fs";
import { afterEach, describe, expect, test } from "bun:test";
import { syncPaymasterPolicy } from "../paymaster";
import { resolveRepoPath } from "../shared/repo";

const originalFetch = globalThis.fetch;
const outputPath = resolveRepoPath(".context/paymaster/eternum-actions-mainnet-alpha.json");

afterEach(() => {
  globalThis.fetch = originalFetch;

  if (fs.existsSync(outputPath)) {
    fs.unlinkSync(outputPath);
  }
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
});
