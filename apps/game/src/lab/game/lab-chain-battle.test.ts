// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { executeGameplayAccountTransaction } from "@bibliothecadao/eternum/game-client";
import { encodeNativeCommand } from "@bibliothecadao/provider";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { nativeBindings } from "@/runtime/world/native-bindings";
import { SITE } from "@/ui/features/frontier/sites/site-fixture";
import { SPIRE_ARMY } from "@/ui/features/frontier/spire-fixture";
import { installLabChain, LAB_GAME } from "./lab-chain";
import { ruinFightScenario } from "./ruin-fight-scenario";

it("sends a ruin fight through the lab account with its payout events separate from persistent facts", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ shards: [] })),
  );
  await installLabChain(ruinFightScenario, Date.now());
  const span = encodeNativeCommand(nativeBindings.commandAbi, {
    kind: "BattleGuard",
    value: { attacker_id: SPIRE_ARMY, defender_id: SITE },
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
    const sent = window.__labChain!.sent.at(-1)!;
    expect(sent.command.kind).toBe("BattleGuard");
    expect(sent.answered.find(({ model }) => model === "StoryEvent")?.value).toMatchObject({
      story: { SitePayout: { site_id: SITE } },
    });
    expect(sent.answered.find(({ model }) => model === "BattleEvent")?.value).toMatchObject({ defender_id: SITE });
    expect(errors).not.toHaveBeenCalled();
  } finally {
    vi.useRealTimers();
    vi.restoreAllMocks();
  }
});
