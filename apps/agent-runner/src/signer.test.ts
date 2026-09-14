import type { GameClient } from "@bibliothecadao/eternum";
import { describe, expect, it, vi } from "vitest";

import type { RunnerConfig } from "./config";
import { resolveRunnerSigner } from "./signer";

const SPECTATOR_CONFIG = {
  chain: "madara",
  rpcUrl: "https://rpc.example",
  signer: { mode: "none" },
} as RunnerConfig;

describe("resolveRunnerSigner", () => {
  it("returns null in none mode and leaves the client spectating", async () => {
    const client = { connect: vi.fn(), signer: null } as unknown as GameClient;

    const signer = await resolveRunnerSigner(SPECTATOR_CONFIG, client, "/tmp/agent-runner-test");

    expect(signer).toBeNull();
    expect(client.connect).not.toHaveBeenCalled();
  });
});
