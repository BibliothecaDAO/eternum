import { useGame } from "@/hooks/context/game-context";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { type ChestRewardSystemUpdate, configManager, WorldUpdateListener } from "@bibliothecadao/eternum";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { useEffect } from "react";
import { attributeLevel } from "../attributes/attributes";
import { isPlayersArmy } from "../frontier-home";
import { type ChestResult, resolveChestOpening } from "./chest-moment";
import { readChestOutcome } from "./chest-outcome";
import { relicName } from "./relic-name";

/**
 * The player's own chest results end the opening they tapped: a LORDS roll at once, a relic once its attribute offer
 * is on the army. The contract grants that offer with the story, and an army can only open a chest with no offer
 * waiting, so the army's pending Relic offer is this chest's.
 */
export const useChestResults = (): void => {
  const { setup } = useGame();
  const player = useAccountStore((state) => state.account?.address ?? null);
  useEffect(() => {
    if (!player) return;
    let waiting: ChestRewardSystemUpdate | null = null;
    const settle = () => {
      const result = waiting && readChestResult(setup.store, waiting);
      if (!result) return;
      waiting = null;
      resolveChestOpening(result);
    };
    const stopStories = new WorldUpdateListener(setup).ChestRewards.onChestReward((reward) => {
      const army = { game_id: configManager.getActiveGameId(), explorer_id: reward.explorerId };
      if (!isPlayersArmy(setup.store, army, player)) return;
      waiting = reward;
      settle();
    });
    const stopFacts = setup.store.subscribe(settle);
    return () => {
      stopStories();
      stopFacts();
    };
  }, [player, setup]);
};

/** The moment's result from a chest story and the facts beside it; null while a relic's offer has yet to arrive. */
const readChestResult = (
  store: Pick<NativeFactStore, "get" | "require">,
  reward: ChestRewardSystemUpdate,
): ChestResult | null => {
  const gameId = configManager.getActiveGameId();
  const outcome = readChestOutcome(reward, store.require("ChestRules", { game_id: gameId }));
  if (outcome.kind === "lords") return { outcome };
  const progress = store.get("ArmyProgress", { game_id: gameId, explorer_id: reward.explorerId });
  const offer = progress?.pending;
  if (!progress || offer?.source !== "Relic") return null;
  return {
    outcome,
    relic: {
      name: relicName(reward.resultKey),
      offer: {
        amount: offer.amount,
        choices: offer.choices.map((attribute) => ({ attribute, level: attributeLevel(progress, attribute) })),
      },
    },
  };
};
