import { afterEach, expect, it, vi } from "vitest";
import type { Account, ProviderInterface } from "starknet";
import { useEventFeedStore } from "@/ui/features/event-feed/event-feed-store";
import { configureGameplayAccountSubmits } from "./gameplay-account-submit";
import { recoverGameplaySigner } from "./gameplay-signer-recovery";

const call = { contractAddress: "0x1", entrypoint: "move", calldata: [] };
const invalidSignature = () =>
  Object.assign(new Error("Validate failure"), {
    code: 55,
    data: { error: "Account: invalid signature" },
  });
let nextAddress = 500;
function fixture(onChainKey = "0x99") {
  const address = `0x${nextAddress++}`;
  const provider = { callContract: vi.fn().mockResolvedValue([onChainKey]) };
  const api = { rotate: vi.fn().mockResolvedValue(address), bind: vi.fn().mockResolvedValue(undefined) };
  const execute = vi.fn().mockRejectedValueOnce(invalidSignature()).mockResolvedValue({ transaction_hash: "0x123" });
  const account = { address, execute, getNonce: vi.fn().mockResolvedValue("0x1") };
  const isCurrent = vi.fn(() => true);
  const recover = vi.fn(() =>
    recoverGameplaySigner({
      provider: provider as unknown as ProviderInterface,
      address,
      publicKey: "0x11",
      api,
      isCurrent,
    }),
  );
  const configured = configureGameplayAccountSubmits(account as unknown as Account, "madara", recover);
  return { address, provider, api, execute, account, configured, recover, isCurrent };
}
afterEach(() => {
  useEventFeedStore.setState({ notices: [] });
});

it("compares a stale key, rotates then binds, writes one feed row and retries the same move", async () => {
  const f = fixture();
  await expect(f.configured.execute(call)).resolves.toEqual({ transaction_hash: "0x123" });
  expect(f.provider.callContract).toHaveBeenCalledWith({
    contractAddress: f.address,
    entrypoint: "get_public_key",
    calldata: [],
  });
  expect(f.api.rotate).toHaveBeenCalledOnce();
  expect(f.api.rotate).toHaveBeenCalledWith("0x11");
  expect(f.api.bind).toHaveBeenCalledWith(f.address, "0x11");
  expect(f.api.rotate.mock.invocationCallOrder[0]).toBeLessThan(f.api.bind.mock.invocationCallOrder[0]);
  expect(f.execute).toHaveBeenCalledTimes(2);
  expect(f.execute.mock.calls.map(([calls]) => calls)).toEqual([call, call]);
  expect(useEventFeedStore.getState().notices).toMatchObject([
    { title: "This game was signed in elsewhere. This tab took control.", ttlMs: 0 },
  ]);
});
it("does not rotate or retry if the on-chain key already matches", async () => {
  const f = fixture("0x11");
  await expect(f.configured.execute(call)).rejects.toThrow("Validate failure");
  expect(f.api.rotate).not.toHaveBeenCalled();
  expect(f.execute).toHaveBeenCalledOnce();
  expect(useEventFeedStore.getState().notices).toHaveLength(0);
});
it("does not recover for another submission error", async () => {
  const f = fixture();
  f.execute.mockReset().mockRejectedValue(new Error("Insufficient resources"));
  await expect(f.configured.execute(call)).rejects.toThrow("Insufficient resources");
  expect(f.recover).not.toHaveBeenCalled();
});
it("never loops when the retry also fails", async () => {
  const f = fixture();
  f.execute.mockReset().mockRejectedValue(invalidSignature());
  await expect(f.configured.execute(call)).rejects.toThrow("Validate failure");
  expect(f.execute).toHaveBeenCalledTimes(2);
  expect(f.api.rotate).toHaveBeenCalledOnce();
  expect(useEventFeedStore.getState().notices).toHaveLength(1);
});
it("shares one recovery across concurrent failures and retries late responses without a second rotation", async () => {
  const f = fixture();
  let rejectLate!: (reason: unknown) => void;
  f.execute
    .mockReset()
    .mockRejectedValueOnce(invalidSignature())
    .mockRejectedValueOnce(invalidSignature())
    .mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectLate = reject;
        }),
    )
    .mockResolvedValue({ transaction_hash: "0x123" });
  const early = [f.configured.execute(call), f.configured.execute(call)];
  const late = f.configured.execute(call);
  await Promise.all(early);
  rejectLate(invalidSignature());
  await late;
  expect(f.api.rotate).toHaveBeenCalledOnce();
  expect(f.execute).toHaveBeenCalledTimes(6);
  expect(useEventFeedStore.getState().notices).toHaveLength(1);
});
it("does not rotate after the identity session is replaced", async () => {
  const f = fixture();
  f.isCurrent.mockReturnValue(false);
  await expect(f.configured.execute(call)).rejects.toThrow("Validate failure");
  expect(f.api.rotate).not.toHaveBeenCalled();
});
it("does not retry or bind if the authority rotated a different account", async () => {
  const f = fixture();
  f.api.rotate.mockResolvedValue("0xdead");
  await expect(f.configured.execute(call)).rejects.toThrow("unexpected gameplay account");
  expect(f.api.bind).not.toHaveBeenCalled();
  expect(f.execute).toHaveBeenCalledOnce();
});
