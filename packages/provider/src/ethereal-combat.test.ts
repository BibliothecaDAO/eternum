import type { AccountInterface, Abi, Call } from "starknet";
import { describe, expect, it, vi } from "vitest";
import bindings from "../../../contracts/l3/world-native/schema/bindings.json";
import { EternumProvider } from "./index";
const signer = { address: "0x123" } as AccountInterface;
const attacks = [
  ["attack_explorer_vs_explorer", { aggressor_id: 1, defender_id: 2, steal_resources: [] }, ["Battle"]],
  ["attack_explorer_vs_guard", { explorer_id: 1, structure_id: 2 }, ["BattleGuard"]],
  ["attack_guard_vs_explorer", { structure_id: 1, structure_guard_slot: 0, explorer_id: 2 }, ["GuardAttack"]],
  [
    "attack_explorer_vs_guard_and_garrison",
    { explorer_id: 1, structure_id: 2, structure_direction: 0, to_guard_slot: 0, count: 100 },
    ["BattleGuard", "ManageTroops"],
  ],
] as const;
describe("recorded combat commands", () => {
  it.each(attacks)("encodes %s through the season domain", async (method, args, expected) => {
    const provider = new EternumProvider(
      { native: { version: 1 }, world: { address: "0x77" }, contracts: [] } as any,
      "http://127.0.0.1:1",
      undefined,
      { gameId: 7 },
    );
    provider.setNativeSubmission(vi.fn(), bindings.commandAbi as Abi, () => 1);
    const enqueue = vi.spyOn(provider.promiseQueue, "enqueue").mockResolvedValue({ transaction_hash: "0x55" } as any);
    await (provider[method] as Function)({ ...args, signer });
    expect(enqueue.mock.calls.map(([queued]) => (queued.calls as Call).entrypoint)).toEqual(expected);
    for (const [queued] of enqueue.mock.calls)
      expect(queued.calls).toMatchObject({ contractAddress: "0x77", calldata: expect.arrayContaining(["7"]) });
  });
});
