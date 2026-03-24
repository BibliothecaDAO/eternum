import type { SpawnSyncReturns } from "node:child_process";
import { describe, expect, test } from "bun:test";
import {
  deleteSlotIndexerDeployment,
  ensureSlotIndexerTier,
  listSlotToriiDeploymentNamesFromAccountInfo,
  resolveSlotToriiLiveState,
} from "../indexing/slot-torii";

function buildSlotResult(options: {
  status?: number;
  stdout?: string;
  stderr?: string;
  error?: Error;
}): SpawnSyncReturns<string> {
  return {
    pid: 1,
    status: options.status ?? 0,
    stdout: options.stdout || "",
    stderr: options.stderr || "",
    error: options.error,
    output: [null, options.stdout || "", options.stderr || ""],
    signal: null,
  } as SpawnSyncReturns<string>;
}

describe("listSlotToriiDeploymentNamesFromAccountInfo", () => {
  test("keeps only torii deployments from slot a info output", () => {
    const gameNames = listSlotToriiDeploymentNamesFromAccountInfo(`
Deployment: bltz-franky-01/torii
Deployment: bltz-franky-02/torii
Deployment: eternum-blitz-slot-4/katana
Deployment: bltz-franky-01/torii
`);

    expect(gameNames).toEqual(["bltz-franky-01", "bltz-franky-02"]);
  });
});

describe("resolveSlotToriiLiveState", () => {
  test("falls back to slot d list when describe is unavailable", () => {
    const liveState = resolveSlotToriiLiveState("bltz-franky-01", {
      slotCommandRunner: (args) => {
        if (args.join(" ") === "d describe bltz-franky-01 torii") {
          return buildSlotResult({
            status: 1,
            stderr: "dial tcp 127.0.0.1:443: connect: connection refused",
          });
        }

        if (args.join(" ") === "d list") {
          return buildSlotResult({
            stdout: "Project: bltz-franky-01\nService: torii\n",
          });
        }

        throw new Error(`Unexpected slot args: ${args.join(" ")}`);
      },
    });

    expect(liveState.state).toBe("existing");
    expect(liveState.stateSource).toBe("list");
    expect(liveState.describeError).toContain("connection refused");
  });
});

describe("ensureSlotIndexerTier", () => {
  test("skips updates when the current tier already matches", () => {
    const result = ensureSlotIndexerTier({
      name: "bltz-franky-01",
      tier: "pro",
      slotCommandRunner: (args) => {
        if (args.join(" ") === "d describe bltz-franky-01 torii") {
          return buildSlotResult({
            stdout: "Tier: pro\nUrl: https://torii.example\nVersion: v1.8.15\nBranch: main\n",
          });
        }

        throw new Error(`Unexpected slot args: ${args.join(" ")}`);
      },
    });

    expect(result.action).toBe("tier-already-matched");
    expect(result.liveState.currentTier).toBe("pro");
  });

  test("updates the tier and re-reads live state", () => {
    let describeCallCount = 0;

    const result = ensureSlotIndexerTier({
      name: "bltz-franky-01",
      tier: "legendary",
      slotCommandRunner: (args) => {
        if (args.join(" ") === "d describe bltz-franky-01 torii") {
          describeCallCount += 1;
          return buildSlotResult({
            stdout:
              describeCallCount === 1
                ? "Tier: basic\nUrl: https://torii.example\nVersion: v1.8.15\nBranch: main\n"
                : "Tier: legendary\nUrl: https://torii.example\nVersion: v1.8.15\nBranch: main\n",
          });
        }

        if (args.join(" ") === "d update --tier legendary bltz-franky-01 torii") {
          return buildSlotResult({});
        }

        throw new Error(`Unexpected slot args: ${args.join(" ")}`);
      },
    });

    expect(result.action).toBe("tier-updated");
    expect(result.previousTier).toBe("basic");
    expect(result.liveState.currentTier).toBe("legendary");
  });
});

describe("deleteSlotIndexerDeployment", () => {
  test("skips deletes when the deployment is already missing", () => {
    const result = deleteSlotIndexerDeployment({
      name: "bltz-franky-01",
      slotCommandRunner: (args) => {
        if (args.join(" ") === "d describe bltz-franky-01 torii") {
          return buildSlotResult({
            status: 1,
            stderr: 'deployment "bltz-franky-01" not found',
          });
        }

        throw new Error(`Unexpected slot args: ${args.join(" ")}`);
      },
    });

    expect(result.action).toBe("already-missing");
    expect(result.liveState.state).toBe("missing");
  });

  test("deletes the deployment and verifies that it is gone", () => {
    let describeCallCount = 0;

    const result = deleteSlotIndexerDeployment({
      name: "bltz-franky-01",
      slotCommandRunner: (args) => {
        if (args.join(" ") === "d describe bltz-franky-01 torii") {
          describeCallCount += 1;

          if (describeCallCount === 1) {
            return buildSlotResult({
              stdout: "Tier: pro\nUrl: https://torii.example\nVersion: v1.8.15\nBranch: main\n",
            });
          }

          return buildSlotResult({
            status: 1,
            stderr: 'deployment "bltz-franky-01" not found',
          });
        }

        if (args.join(" ") === "d delete bltz-franky-01 torii -f") {
          return buildSlotResult({});
        }

        throw new Error(`Unexpected slot args: ${args.join(" ")}`);
      },
    });

    expect(result.action).toBe("deleted");
    expect(result.previousTier).toBe("pro");
    expect(result.liveState.state).toBe("missing");
  });
});
