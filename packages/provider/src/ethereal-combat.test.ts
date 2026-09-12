import type { AccountInterface, Call } from "starknet";
import { describe, expect, it, vi } from "vitest";
import { EternumProvider } from "./index";

const signer = { address: "0x123" } as AccountInterface;
const battle = "0xa1";
const manifest = {
  world: { address: "0x77", abi: [{ type: "interface", name: "IWorld", items: [] }] },
  contracts: [
    { address: battle, tag: "s2-troop_battle_systems", abi: [] },
    { address: "0xa2", tag: "s2-troop_management_systems", abi: [] },
  ],
} as any;

const attacks = [
  ["attack_explorer_vs_explorer", { aggressor_id: 1, defender_id: 2, steal_resources: [] }],
  ["attack_explorer_vs_guard", { explorer_id: 1, structure_id: 2 }],
  ["attack_guard_vs_explorer", { structure_id: 1, structure_guard_slot: 0, explorer_id: 2 }],
  [
    "attack_explorer_vs_guard_and_garrison",
    { explorer_id: 1, structure_id: 2, structure_direction: 0, to_guard_slot: 0, count: 100 },
  ],
] as const;

describe("ethereal combat randomness", () => {
  it.each(attacks)("requests one VRF seed for %s only when the defender is ethereal", async (method, args) => {
    for (const ethereal of [false, true]) {
      const provider = new EternumProvider(manifest, "http://127.0.0.1:1", "0x99", undefined, {
        namespace: "s2",
        gameId: 7,
      });
      const enqueue = vi.spyOn(provider.promiseQueue, "enqueue").mockResolvedValue({ transaction_hash: "0x55" } as any);
      await (provider[method] as Function)({ ...args, signer, ethereal });
      const queued = enqueue.mock.calls[0][0].calls;
      const scoped = (provider as any).withGameIdCalldata(queued);
      const calls: Call[] = Array.isArray(scoped) ? scoped : [scoped];
      expect(calls.filter((call) => call.entrypoint === "request_random")).toHaveLength(ethereal ? 1 : 0);
      if (ethereal)
        expect(calls.shift()).toEqual({
          contractAddress: "0x99",
          entrypoint: "request_random",
          calldata: [battle, 0, signer.address],
        });
      expect(calls[0].contractAddress).toBe(battle);
      expect(calls[0].calldata?.[0]).toBe("7");
      expect(calls).toHaveLength(method.endsWith("and_garrison") ? 2 : 1);
    }
  });
});
