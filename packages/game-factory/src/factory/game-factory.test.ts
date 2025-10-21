import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../deployment/executor", () => ({
  createDeploymentExecutor: vi.fn(),
}));

import type { AccountInterface } from "starknet";
import { GameFactory } from "./game-factory";
import { createClassRegistry } from "../config";
import { ExecutionFailedError, PlanValidationError } from "../errors";
import type { DeploymentExecutor, GameDeploymentPreset } from "../types";
import { createDeploymentExecutor } from "../deployment/executor";

const accountStub = {} as AccountInterface;

describe("GameFactory", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("deploys a game, runs hooks, and stores the resulting artifact", async () => {
    const registry = createClassRegistry();
    registry.set("sepolia", { id: "module.core", classHash: "0xabc" });

    const preset: GameDeploymentPreset = {
      id: "custom",
      metadata: { presetMeta: true },
      modules: [
        {
          id: "core-module",
          classId: "module.core",
          constructor: undefined,
          metadata: { moduleMeta: true },
        },
      ],
    };

    const executeMock: DeploymentExecutor["execute"] = vi.fn(async (plan) => ({
      plan,
      receipts: plan.steps.map((step, index) => ({
        stepId: step.id,
        type: step.type,
        status: "success" as const,
        transactionHash: `0xhash-${index}`,
        contractAddress: `0xaddr-${index}`,
        startedAt: "2024-01-01T00:00:00.000Z",
        finishedAt: "2024-01-01T00:00:01.000Z",
      })),
    }));
    const estimateMock: DeploymentExecutor["estimate"] = vi.fn();
    vi.mocked(createDeploymentExecutor).mockReturnValue({
      execute: executeMock,
      estimate: estimateMock,
    });

    const beforePlan = vi.fn();
    const afterPlan = vi.fn();
    const beforeExecute = vi.fn();
    const afterExecute = vi.fn();

    const factory = new GameFactory(
      {
        account: accountStub,
        network: "sepolia",
        registry,
        presets: {
          custom: preset,
        },
      },
      {
        beforePlan,
        afterPlan,
        beforeExecute,
        afterExecute,
      },
    );

    const request = { preset: "custom" as const };
    const result = await factory.deployGame(request);

    expect(beforePlan).toHaveBeenCalledWith(request);
    expect(afterPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        presetId: "custom",
        steps: expect.arrayContaining([
          expect.objectContaining({
            id: "core-module",
            classId: "module.core",
          }),
        ]),
      }),
    );
    expect(beforeExecute).toHaveBeenCalledWith(result.plan);
    expect(afterExecute).toHaveBeenCalledWith(result);

    expect(createDeploymentExecutor).toHaveBeenCalledWith(accountStub);
    expect(executeMock).toHaveBeenCalledTimes(1);

    expect(result.artifact.contracts["core-module"]).toMatchObject({
      id: "core-module",
      classHash: "0xabc",
      transactionHash: "0xhash-0",
      address: "0xaddr-0",
      dependsOn: [],
      metadata: { moduleMeta: true },
    });

    expect(factory.listDeployments()).toEqual([result.artifact]);
  });

  it("rethrows GameFactory errors from the executor without wrapping", async () => {
    const registry = createClassRegistry();
    const planError = new PlanValidationError("invalid plan");
    const executor: DeploymentExecutor = {
      execute: vi.fn(async () => {
        throw planError;
      }),
      estimate: vi.fn(),
    };
    vi.mocked(createDeploymentExecutor).mockReturnValue(executor);

    const factory = new GameFactory(
      {
        account: accountStub,
        network: "local",
        registry,
      },
      {},
    );

    await expect(factory.deployGame()).rejects.toBe(planError);
  });

  it("wraps unexpected errors thrown during execution", async () => {
    const registry = createClassRegistry();
    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const executor: DeploymentExecutor = {
      execute: vi.fn(async () => {
        throw new Error("boom");
      }),
      estimate: vi.fn(),
    };
    vi.mocked(createDeploymentExecutor).mockReturnValue(executor);

    const factory = new GameFactory(
      {
        account: accountStub,
        network: "local",
        registry,
        logger,
      },
      {},
    );

    await expect(factory.deployGame()).rejects.toThrowError(ExecutionFailedError);
    expect(logger.error).toHaveBeenCalledWith("Deployment failed", expect.any(Object));
  });
});
