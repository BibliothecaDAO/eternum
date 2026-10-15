import { describe, expect, it, vi } from "vitest";

import { ActionRefusedError, createSystemCalls } from "./create-system-calls";

const signer = { address: "0x1" };

const systemCallsWith = (refusal: { now: string | null }) => {
  const provider = { burn_resource_for_resource_production: vi.fn().mockResolvedValue({ transaction_hash: "0xa" }) };
  const onError = vi.fn();
  const calls = createSystemCalls({ provider, authHandler: { refuseNow: () => refusal.now, onError } });
  return { provider, onError, calls };
};

describe("a system call", () => {
  it("is not sent while the game refuses actions, and says why without reporting an error", async () => {
    const { provider, onError, calls } = systemCallsWith({ now: "Starts in 4m 00s" });
    const send = calls.burn_resource_for_resource_production({ signer } as never);
    await expect(send).rejects.toBeInstanceOf(ActionRefusedError);
    await expect(send).rejects.toThrow("Starts in 4m 00s");
    expect(provider.burn_resource_for_resource_production).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it("is sent once the game accepts actions", async () => {
    const refusal = { now: "Starts in 0m 01s" as string | null };
    const { provider, calls } = systemCallsWith(refusal);
    await expect(calls.burn_resource_for_resource_production({ signer } as never)).rejects.toThrow();
    refusal.now = null;
    await expect(calls.burn_resource_for_resource_production({ signer } as never)).resolves.toEqual({
      transaction_hash: "0xa",
    });
    expect(provider.burn_resource_for_resource_production).toHaveBeenCalledTimes(1);
  });
});
