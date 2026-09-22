import type { GameClient } from "@bibliothecadao/eternum";
import { ec, type AccountInterface } from "starknet";
import { describe, expect, it, vi } from "vitest";

import type { RunnerConfig } from "./config";
import { resolveRunnerSigner, signRunnerIntent } from "./signer";

const SPECTATOR_CONFIG = { signer: { mode: "none" } } as RunnerConfig;

describe("resolveRunnerSigner", () => {
  it("returns null in none mode and leaves the client spectating", async () => {
    const client = { connect: vi.fn(), signer: null } as unknown as GameClient;

    const signer = await resolveRunnerSigner(SPECTATOR_CONFIG, client, "/tmp/agent-runner-test");

    expect(signer).toBeNull();
    expect(client.connect).not.toHaveBeenCalled();
  });
});

describe("signRunnerIntent", () => {
  const privateKey = "0x3039";
  const config = {
    signer: { mode: "key", gameplayAccountAddress: "0x123", gameplayPrivateKey: privateKey },
  } as RunnerConfig;

  it("signs with the gameplay key in the account's [r, s] layout", async () => {
    const digest = "0x456";
    const signature = await signRunnerIntent(config, 1, { address: "0x123" } as AccountInterface, digest);
    const expected = ec.starkCurve.sign(digest, privateKey);
    expect(signature).toEqual([`0x${expected.r.toString(16)}`, `0x${expected.s.toString(16)}`]);
  });

  it("rejects a changed gameplay identity before signing", async () => {
    await expect(signRunnerIntent(config, 1, { address: "0x124" } as AccountInterface, "0x456")).rejects.toThrow(
      "Gameplay identity changed",
    );
  });
});
