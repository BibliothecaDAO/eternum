import { describe, expect, mock, test } from "bun:test";
import type { AwsRuntimeActionResult } from "../runtime/aws-runtime";
import { ensureIndexerDeployment, resolveIndexerArtifactStateFromProvider } from "../runtime/indexer-provider";

const awsResult: AwsRuntimeActionResult = {
  mode: "aws-ecs",
  action: "created",
  requestedTier: "basic",
  liveState: {
    provider: "aws",
    runtimeKind: "torii",
    runtimeName: "bltz-fire-gate-42",
    serviceName: "slot-blitz-torii-bltz-fire-gate-42",
    status: "existing",
    endpointUrl: "https://runtime.realms.world/x/bltz-fire-gate-42/torii",
    tier: "basic",
    version: "v1.8.16",
    region: "us-east-1",
    serviceArn: "arn:aws:ecs:service/runtime/bltz",
    health: {
      status: "healthy",
      checkedAt: "2026-06-22T00:00:00.000Z",
      endpoint: "https://runtime.realms.world/x/bltz-fire-gate-42/torii/health",
    },
  },
};

describe("ensureIndexerDeployment", () => {
  test("uses AWS when the request asks for the AWS runtime provider", async () => {
    const ensureAwsToriiRuntime = mock(async () => awsResult);
    const ensureSlotIndexerDeployment = mock(() => {
      throw new Error("slot provider should not run");
    });

    const result = await ensureIndexerDeployment(
      {
        env: "slot",
        runtimeProvider: "aws",
        environmentId: "slot.blitz",
        rpcUrl: "https://runtime.realms.world/x/eternum-slot/katana/rpc/v0_9",
        namespaces: "s1_eternum",
        worldName: "bltz-fire-gate-42",
        worldAddress: "0x123",
      },
      {
        ensureAwsToriiRuntime,
        ensureSlotIndexerDeployment,
      },
    );

    expect(result).toEqual(awsResult);
    expect(ensureAwsToriiRuntime).toHaveBeenCalledTimes(1);
    expect(ensureSlotIndexerDeployment).not.toHaveBeenCalled();
  });

  test("keeps Slot available as an explicit rollback provider", async () => {
    const ensureAwsToriiRuntime = mock(async () => awsResult);
    const ensureSlotIndexerDeployment = mock(() => ({
      mode: "slot-direct" as const,
      action: "already-live" as const,
      requestedTier: "basic" as const,
      liveState: {
        state: "existing" as const,
        stateSource: "describe" as const,
        currentTier: "basic" as const,
        url: "https://api.cartridge.gg/x/bltz-fire-gate-42/torii",
      },
    }));

    const result = await ensureIndexerDeployment(
      {
        env: "slot",
        runtimeProvider: "slot",
        environmentId: "slot.blitz",
        rpcUrl: "https://api.cartridge.gg/x/eternum-blitz-slot-4/katana/rpc/v0_9",
        namespaces: "s1_eternum",
        worldName: "bltz-fire-gate-42",
        worldAddress: "0x123",
      },
      {
        ensureAwsToriiRuntime,
        ensureSlotIndexerDeployment,
      },
    );

    expect(result.mode).toBe("slot-direct");
    expect(ensureSlotIndexerDeployment).toHaveBeenCalledTimes(1);
    expect(ensureAwsToriiRuntime).not.toHaveBeenCalled();
  });
});

describe("resolveIndexerArtifactStateFromProvider", () => {
  test("publishes AWS runtime details into indexer artifacts", () => {
    expect(resolveIndexerArtifactStateFromProvider(awsResult)).toMatchObject({
      indexerCreated: true,
      indexerMode: "aws-ecs",
      indexerTier: "basic",
      indexerUrl: "https://runtime.realms.world/x/bltz-fire-gate-42/torii",
      indexerVersion: "v1.8.16",
      runtimeProvider: "aws",
      awsRuntime: {
        provider: "aws",
        runtimeKind: "torii",
        runtimeName: "bltz-fire-gate-42",
        serviceName: "slot-blitz-torii-bltz-fire-gate-42",
      },
    });
  });
});
