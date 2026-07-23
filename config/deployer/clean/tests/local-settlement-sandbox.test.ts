import { describe, expect, test } from "bun:test";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  buildLocalSettlementSandboxPlan,
  runLocalSettlementSandboxSmoke,
  type LocalSettlementChainPlan,
  type LocalSettlementChainProcess,
  type LocalSettlementSandboxFailedResult,
  type LocalSettlementSandboxPlan,
  type LocalSettlementSandboxRuntime,
} from "../settlement/local-sandbox";
import { writeLocalSettlementSandboxEvidence } from "../settlement/local-sandbox-evidence";
import { LocalKatanaSandboxRuntime } from "../settlement/local-sandbox-runtime";

const RUN_ROOT = "/tmp/eternum-settlement-e2e/g17-smoke";

describe("local two-chain settlement sandbox", () => {
  test("plans two isolated Katana chains as explicitly test-only evidence", () => {
    const plan = buildTestPlan();

    expect(plan).toEqual({
      schemaVersion: 1,
      environmentId: "local.blitz",
      runId: "g17-smoke",
      runRoot: RUN_ROOT,
      evidenceClass: "test-only",
      productionCompletionEvidence: false,
      attestationMode: "fixture",
      chains: [
        {
          layer: "settlement",
          chainId: "WP_BLITZ_L1_LOCAL",
          rpcUrl: "http://127.0.0.1:5051",
          port: 5051,
          seed: 1101,
          dataDir: `${RUN_ROOT}/settlement/data`,
          logFile: `${RUN_ROOT}/settlement/katana.log`,
        },
        {
          layer: "appchain",
          chainId: "WP_BLITZ_L3_LOCAL",
          rpcUrl: "http://127.0.0.1:5052",
          port: 5052,
          seed: 3101,
          dataDir: `${RUN_ROOT}/appchain/data`,
          logFile: `${RUN_ROOT}/appchain/katana.log`,
        },
      ],
    });
  });

  test("rejects fixture evidence outside local.blitz before planning a runtime", () => {
    expect(() =>
      buildLocalSettlementSandboxPlan({
        environmentId: "sepolia.blitz",
        runId: "g17-smoke",
        runRoot: RUN_ROOT,
        attestationMode: "fixture",
      }),
    ).toThrow("Fixture settlement evidence is restricted to local.blitz");

    expect(() =>
      buildLocalSettlementSandboxPlan({
        environmentId: "mainnet.blitz",
        runId: "g17-smoke",
        runRoot: RUN_ROOT,
        attestationMode: "fixture",
      }),
    ).toThrow("Fixture settlement evidence is restricted to local.blitz");
  });

  test("rejects shared ports and broad run roots", () => {
    expect(() =>
      buildLocalSettlementSandboxPlan({
        environmentId: "local.blitz",
        runId: "g17-smoke",
        runRoot: RUN_ROOT,
        attestationMode: "fixture",
        settlementPort: 5051,
        appchainPort: 5051,
      }),
    ).toThrow("distinct ports");

    expect(() =>
      buildLocalSettlementSandboxPlan({
        environmentId: "local.blitz",
        runId: "g17-smoke",
        runRoot: "/",
        attestationMode: "fixture",
      }),
    ).toThrow("dedicated absolute run root");
  });

  test("reports both observed chain identities without promoting fixture evidence", async () => {
    const plan = buildTestPlan();
    const runtime = new ObservedSandboxRuntime();

    const result = await runLocalSettlementSandboxSmoke(plan, runtime);

    expect(result).toEqual({
      schemaVersion: 1,
      operation: "local-settlement-sandbox-smoke",
      status: "passed",
      environmentId: "local.blitz",
      runId: "g17-smoke",
      evidenceClass: "test-only",
      productionCompletionEvidence: false,
      attestationMode: "fixture",
      chains: [
        {
          layer: "settlement",
          plannedChainId: "WP_BLITZ_L1_LOCAL",
          observedChainId: "WP_BLITZ_L1_LOCAL",
          rpcUrl: "http://127.0.0.1:5051",
          processId: 1101,
          blockNumber: 0,
          genesisHash: "0x1101",
          stateRoot: "0x1102",
          katanaVersion: "katana 1.7.1 (7882660)",
          startedAt: "2026-07-24T01:00:00.000Z",
          readyAt: "2026-07-24T01:00:01.000Z",
          stoppedAt: "2026-07-24T01:00:02.000Z",
        },
        {
          layer: "appchain",
          plannedChainId: "WP_BLITZ_L3_LOCAL",
          observedChainId: "WP_BLITZ_L3_LOCAL",
          rpcUrl: "http://127.0.0.1:5052",
          processId: 3101,
          blockNumber: 0,
          genesisHash: "0x3101",
          stateRoot: "0x3102",
          katanaVersion: "katana 1.7.1 (7882660)",
          startedAt: "2026-07-24T01:00:00.000Z",
          readyAt: "2026-07-24T01:00:01.000Z",
          stoppedAt: "2026-07-24T01:00:02.000Z",
        },
      ],
    });
  });

  test("rejects an observed chain substitution and leaves no sandbox process running", async () => {
    const plan = buildTestPlan();
    const runtime = new SubstitutedAppchainRuntime();

    const result = await runLocalSettlementSandboxSmoke(plan, runtime);

    requireFailedResult(result);
    expect(result.failures).toEqual([
      expect.objectContaining({
        step: "identity-verification",
        layer: "appchain",
        errorMessage: expect.stringContaining("appchain chain identity mismatch"),
      }),
    ]);
    expect(runtime.activeLayers).toEqual([]);
  });

  test("attempts every chain cleanup when one stop fails", async () => {
    const plan = buildTestPlan();
    const runtime = new FailingStopRuntime();

    const result = await runLocalSettlementSandboxSmoke(plan, runtime);

    requireFailedResult(result);
    expect(result.failures).toEqual([
      expect.objectContaining({
        step: "cleanup",
        layer: "appchain",
        errorMessage: "appchain stop failed",
      }),
    ]);
    expect(runtime.stopAttempts).toEqual(["appchain", "settlement"]);
  });

  test("revalidates the local-only fixture boundary at execution and evidence seams", async () => {
    const temporaryRoot = mkdtempSync(path.join(tmpdir(), "eternum-settlement-boundary-"));
    try {
      const validPlan = buildTestPlan({ runId: "g17-boundary", runRoot: temporaryRoot });
      const forgedPlan = {
        ...validPlan,
        environmentId: "sepolia.blitz",
      } as unknown as LocalSettlementSandboxPlan;
      const runtime = new ObservedSandboxRuntime();
      const validResult = await runLocalSettlementSandboxSmoke(validPlan, new ObservedSandboxRuntime());

      await expect(runLocalSettlementSandboxSmoke(forgedPlan, runtime)).rejects.toThrow(
        "Fixture settlement evidence is restricted to local.blitz",
      );
      expect(runtime.startAttempts).toEqual([]);
      expect(() => writeLocalSettlementSandboxEvidence(forgedPlan, validResult)).toThrow(
        "Fixture settlement evidence is restricted to local.blitz",
      );
      const forgedResult = {
        ...validResult,
        chains: validResult.chains.map((chain, index) =>
          index === 1
            ? {
                ...chain,
                plannedChainId: "WP_UNAPPROVED_L3",
                observedChainId: "WP_UNAPPROVED_L3",
                rpcUrl: "https://non-local.invalid",
              }
            : chain,
        ),
      } as unknown as typeof validResult;
      expect(() => writeLocalSettlementSandboxEvidence(validPlan, forgedResult)).toThrow(
        "does not match its canonical appchain binding",
      );
    } finally {
      rmSync(temporaryRoot, { recursive: true, force: true });
    }
  });

  test("persists structured runtime failures with verification and cleanup outcomes", async () => {
    const temporaryRoot = mkdtempSync(path.join(tmpdir(), "eternum-settlement-failure-"));
    try {
      const plan = buildTestPlan({ runId: "g17-failure", runRoot: temporaryRoot });
      const result = await runLocalSettlementSandboxSmoke(plan, new SubstitutedAppchainRuntime());

      const evidenceFile = writeLocalSettlementSandboxEvidence(plan, result);

      expect(result).toEqual(
        expect.objectContaining({
          status: "failed",
          environmentId: "local.blitz",
          runId: "g17-failure",
          evidenceClass: "test-only",
          productionCompletionEvidence: false,
          failures: [
            expect.objectContaining({
              step: "identity-verification",
              layer: "appchain",
            }),
          ],
          chains: [
            expect.objectContaining({ layer: "settlement", cleanupStatus: "stopped" }),
            expect.objectContaining({ layer: "appchain", cleanupStatus: "stopped" }),
          ],
        }),
      );
      expect(JSON.parse(readFileSync(evidenceFile, "utf8"))).toEqual(result);
    } finally {
      rmSync(temporaryRoot, { recursive: true, force: true });
    }
  });

  test("bounds a stalled RPC request and leaves its owned process stoppable", async () => {
    const temporaryRoot = mkdtempSync(path.join(tmpdir(), "eternum-settlement-timeout-"));
    const fakeKatana = writeFakeKatanaBinary(temporaryRoot);
    const plan = buildTestPlan({ runId: "g17-timeout", runRoot: temporaryRoot });
    const runtime = new LocalKatanaSandboxRuntime({
      katanaBinary: fakeKatana,
      startupTimeoutMs: 60,
      rpcRequestTimeoutMs: 10,
      pollIntervalMs: 1,
    });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = ((_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
      })) as typeof fetch;

    try {
      const process = await runtime.startChain(plan.chains[0]);
      const outcome = await Promise.race([
        runtime.waitForChain(plan.chains[0]).catch((error: unknown) => error),
        delay(250).then(() => "external-test-timeout"),
      ]);

      expect(outcome).toBeInstanceOf(Error);
      expect((outcome as Error).message).toContain("did not become ready within 60ms");
      await runtime.stopChain(process, plan.chains[0]);
    } finally {
      globalThis.fetch = originalFetch;
      rmSync(temporaryRoot, { recursive: true, force: true });
    }
  });

  test("persists the public smoke result as the run evidence artifact", async () => {
    const temporaryRoot = mkdtempSync(path.join(tmpdir(), "eternum-settlement-evidence-"));
    try {
      const plan = buildLocalSettlementSandboxPlan({
        environmentId: "local.blitz",
        runId: "g17-evidence",
        runRoot: temporaryRoot,
        attestationMode: "fixture",
      });
      const result = await runLocalSettlementSandboxSmoke(plan, new ObservedSandboxRuntime());

      const evidenceFile = writeLocalSettlementSandboxEvidence(plan, result);

      expect(evidenceFile).toBe(path.join(temporaryRoot, "run.json"));
      expect(JSON.parse(readFileSync(evidenceFile, "utf8"))).toEqual(result);
    } finally {
      rmSync(temporaryRoot, { recursive: true, force: true });
    }
  });
});

class ObservedSandboxRuntime implements LocalSettlementSandboxRuntime {
  readonly startAttempts: string[] = [];

  async startChain(chain: LocalSettlementChainPlan): Promise<LocalSettlementChainProcess> {
    this.startAttempts.push(chain.layer);
    return {
      layer: chain.layer,
      processId: chain.layer === "settlement" ? 1101 : 3101,
      startedAt: "2026-07-24T01:00:00.000Z",
    };
  }

  async waitForChain(chain: LocalSettlementChainPlan) {
    return {
      observedChainId: chain.chainId,
      blockNumber: 0,
      genesisHash: chain.layer === "settlement" ? "0x1101" : "0x3101",
      stateRoot: chain.layer === "settlement" ? "0x1102" : "0x3102",
      katanaVersion: "katana 1.7.1 (7882660)",
      readyAt: "2026-07-24T01:00:01.000Z",
    };
  }

  async stopChain(_process: LocalSettlementChainProcess, _chain: LocalSettlementChainPlan) {
    return { stoppedAt: "2026-07-24T01:00:02.000Z" };
  }
}

function buildTestPlan(
  overrides: Partial<Pick<LocalSettlementSandboxPlan, "runId" | "runRoot">> = {},
): LocalSettlementSandboxPlan {
  return buildLocalSettlementSandboxPlan({
    environmentId: "local.blitz",
    runId: overrides.runId || "g17-smoke",
    runRoot: overrides.runRoot || RUN_ROOT,
    attestationMode: "fixture",
  });
}

function requireFailedResult(
  result: Awaited<ReturnType<typeof runLocalSettlementSandboxSmoke>>,
): asserts result is LocalSettlementSandboxFailedResult {
  expect(result.status).toBe("failed");
  if (result.status !== "failed") throw new Error("Expected local settlement sandbox failure");
}

function writeFakeKatanaBinary(directory: string): string {
  const binary = path.join(directory, "fake-katana");
  writeFileSync(
    binary,
    [
      "#!/bin/sh",
      'if [ "$1" = "--version" ]; then',
      '  echo "katana test (fixture)"',
      "  exit 0",
      "fi",
      "trap 'exit 0' TERM INT",
      "while :; do sleep 1; done",
      "",
    ].join("\n"),
  );
  chmodSync(binary, 0o700);
  return binary;
}

function delay(durationMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}

class SubstitutedAppchainRuntime extends ObservedSandboxRuntime {
  readonly activeLayers: string[] = [];

  override async startChain(chain: LocalSettlementChainPlan): Promise<LocalSettlementChainProcess> {
    this.activeLayers.push(chain.layer);
    return super.startChain(chain);
  }

  override async waitForChain(chain: LocalSettlementChainPlan) {
    const observation = await super.waitForChain(chain);
    return {
      ...observation,
      observedChainId: chain.layer === "appchain" ? "WP_UNAPPROVED_L3" : observation.observedChainId,
    };
  }

  override async stopChain(process: LocalSettlementChainProcess, chain: LocalSettlementChainPlan) {
    this.activeLayers.splice(this.activeLayers.indexOf(process.layer), 1);
    return super.stopChain(process, chain);
  }
}

class FailingStopRuntime extends ObservedSandboxRuntime {
  readonly stopAttempts: string[] = [];

  override async stopChain(process: LocalSettlementChainProcess, chain: LocalSettlementChainPlan) {
    this.stopAttempts.push(process.layer);
    if (process.layer === "appchain") throw new Error("appchain stop failed");
    return super.stopChain(process, chain);
  }
}
