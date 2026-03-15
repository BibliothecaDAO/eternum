import { describe, expect, test } from "bun:test";
import { executeConfigSteps } from "../config-executor";
import type { ConfigStep } from "../types";

describe("executeConfigSteps", () => {
  test("runs steps inside an explicit batch", async () => {
    const calls: string[] = [];
    const provider = {
      beginBatch: () => {
        calls.push("begin");
      },
      endBatch: async ({ flush }: { flush?: boolean } = {}) => {
        calls.push(`end:${flush === false ? "discard" : "flush"}`);
        return { transaction_hash: "0xabc" };
      },
    };

    const steps: ConfigStep[] = [
      {
        id: "one",
        description: "step one",
        execute: async () => {
          calls.push("one");
        },
      },
      {
        id: "two",
        description: "step two",
        execute: async () => {
          calls.push("two");
        },
      },
    ];

    const result = await executeConfigSteps({
      context: { account: { address: "0x1" } as any, provider, config: {} as any },
      steps,
      mode: "batched",
    });

    expect(calls).toEqual(["begin", "one", "two", "end:flush"]);
    expect(result.transactionHash).toBe("0xabc");
    expect(result.steps.map((step) => step.id)).toEqual(["one", "two"]);
  });

  test("discards the batch on failure", async () => {
    const calls: string[] = [];
    const provider = {
      beginBatch: () => {
        calls.push("begin");
      },
      endBatch: async ({ flush }: { flush?: boolean } = {}) => {
        calls.push(`end:${flush === false ? "discard" : "flush"}`);
        return null;
      },
    };

    const steps: ConfigStep[] = [
      {
        id: "one",
        description: "step one",
        execute: async () => {
          calls.push("one");
        },
      },
      {
        id: "boom",
        description: "step boom",
        execute: async () => {
          throw new Error("boom");
        },
      },
    ];

    await expect(
      executeConfigSteps({
        context: { account: { address: "0x1" } as any, provider, config: {} as any },
        steps,
        mode: "batched",
      }),
    ).rejects.toThrow("boom");

    expect(calls).toEqual(["begin", "one", "end:discard"]);
  });

  test("suppresses legacy step logs unless requested", async () => {
    const logs: string[] = [];
    const provider = {
      beginBatch: () => undefined,
      endBatch: async () => ({ transaction_hash: "0xabc" }),
    };

    const noisyStep: ConfigStep = {
      id: "noisy",
      description: "noisy step",
      execute: async (context) => {
        context.logger?.log("legacy-step-log");
      },
    };

    await executeConfigSteps({
      context: {
        account: { address: "0x1" } as any,
        provider,
        config: {} as any,
        logger: { log: (...args) => logs.push(args.map(String).join(" ")) },
      },
      steps: [noisyStep],
      mode: "batched",
      suppressStepLogs: true,
    });

    await executeConfigSteps({
      context: {
        account: { address: "0x1" } as any,
        provider,
        config: {} as any,
        logger: { log: (...args) => logs.push(args.map(String).join(" ")) },
      },
      steps: [noisyStep],
      mode: "batched",
      suppressStepLogs: false,
    });

    expect(logs).toEqual(["legacy-step-log"]);
  });
});
