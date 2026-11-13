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
  const startedAt = Date.now();
  const scenario = await installLabChain(ruinFightScenario, startedAt);
  const span = encodeNativeCommand(nativeBindings.commandAbi, {
    kind: "BattleGuard",
    value: { attacker_id: SPIRE_ARMY, defender_id: SITE, relic_slot: { kind: "None", value: undefined } },
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
    const failure = new Error("original lab answer refused");
    scenario.answer = () => {
      throw failure;
    };
    vi.setSystemTime(startedAt + 1000);
    await executeGameplayAccountTransaction({
      account: useAccountStore.getState().account!,
      calls: { contractAddress: "0x1ab", entrypoint: "play", calldata: ["1", "3", "0", String(span.length), ...span] },
      shard: { chainId: LAB_GAME.chainId, l2GasBound: BigInt("0x47868c00") },
    });
    expect(window.__labChain!.sent).toHaveLength(1);
    expect(window.__labChain!.rejected).toEqual([
      expect.objectContaining({
        command: sent.command,
        at: scenario.startsAt + 1,
        error: { name: "Error", message: failure.message, stack: failure.stack },
      }),
    ]);
    expect(errors).toHaveBeenLastCalledWith("[lab chain] rejected", sent.command, "at", scenario.startsAt + 1, failure);
  } finally {
    vi.useRealTimers();
    vi.restoreAllMocks();
  }
});
