import type { SpawnSyncReturns } from "node:child_process";
import { describe, expect, test } from "bun:test";
import { ensureSlotIndexerTier, resolveSlotToriiLiveState } from "../indexing/slot-torii";

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
