// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { executeGameplayAccountTransaction } from "@bibliothecadao/eternum/game-client";
import { encodeNativeCommand } from "@bibliothecadao/provider";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { nativeBindings } from "@/runtime/world/native-bindings";
import { relicId } from "@/ui/features/frontier/relics/relic-catalog";
import { SPIRE_ARMY } from "@/ui/features/frontier/spire-fixture";
import { installLabChain, LAB_GAME } from "./lab-chain";
import { farEyeScenario } from "./far-eye-scenario";

it("applies the Far-Eye command through the real fact decoder, including an initially empty Essence balance", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ shard: null })),
  );
  await installLabChain(farEyeScenario, Date.now());
  const span = encodeNativeCommand(nativeBindings.commandAbi, {
    kind: "ApplyRelic",
    value: {
      entity_id: SPIRE_ARMY,
      relic_id: relicId({ kind: "FarEye", rank: 1 }),
      recipient: { kind: "ArmySlot", value: 0 },
    },
  });
  const errors = vi.spyOn(console, "error");
  vi.useFakeTimers();
  try {
    await executeGameplayAccountTransaction({
      account: useAccountStore.getState().account!,
      calls: { contractAddress: "0x1ab", entrypoint: "play", calldata: ["1", "3", "0", String(span.length), ...span] },
      shard: { chainId: LAB_GAME.chainId, l2GasBound: BigInt("0x47868c00") },
    });
    await vi.advanceTimersByTimeAsync(300);
    expect(errors).not.toHaveBeenCalled();
    expect(window.__labChain!.rejected).toEqual([]);
    const facts = window.__labChain!.sent.at(-1)!.answered;
    const tiles = facts.filter(({ model }) => model === "TileOpt");
    expect(tiles).toHaveLength(6);
    expect(new Set(tiles.map(({ value }) => JSON.stringify(value))).size).toBe(6);
    expect(facts.find(({ model }) => model === "ArmyRelics")?.value).toMatchObject({ first: null });
    expect(facts.find(({ model }) => model === "ResourceBalance")?.value).toMatchObject({ balance: "898800000000" });
    expect(facts.find(({ model }) => model === "ExpeditionSpire")?.value).toMatchObject({ reveals: 1, depth: 0 });
  } finally {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  }
});
