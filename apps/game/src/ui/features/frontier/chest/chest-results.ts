import { useGame } from "@/hooks/context/game-context";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { type ChestRewardSystemUpdate, configManager, WorldUpdateListener } from "@bibliothecadao/eternum";
import type { NativeFactStore, NativeRows } from "@bibliothecadao/eternum/game-client";
import { rowInGameSyncScope } from "@bibliothecadao/eternum/game-sync";
import { TileOccupier } from "@bibliothecadao/types";
import { useEffect } from "react";
import { attributeLevel } from "../attributes/attributes";
import { isPlayersArmy } from "../frontier-home";
import { type ChestResult, recoverChestOpening, useChestMoment, resolveChestOpening } from "./chest-moment";
import { readChestOutcome } from "./chest-outcome";
import { relicName } from "./relic-name";

/**
 * The player's own chest results end the opening they tapped: a LORDS roll at once, a relic once its attribute offer
 * is on the army. The contract grants that offer with the story, and an army can only open a chest with no offer
 * waiting, so the army's pending Relic offer is this chest's.
 */
export const useChestResults = (): void => {
  const { setup } = useGame();
  const moment = useChestMoment();
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
      if (moment?.opening && reward.explorerId !== moment.opening.explorerId) return;
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
  }, [player, setup, moment?.opening]);

  useEffect(() => {
    const opening = moment?.opening;
    if (!opening || !moment.confirmed || moment.result) return;
    let active = true;
    const recover = () =>
      queueMicrotask(() => {
        if (!active) return;
        const keys = { game_id: opening.gameId, ...opening.hex };
        const scope = setup.store.subscriptionScope();
        if (!scope.known || !rowInGameSyncScope("TileOccupancy", keys, scope.known)) return;
        const tile = setup.store.get("TileOccupancy", keys);
        if (tile?.category === TileOccupier.Chest) return;
        const progress = setup.store.get("ArmyProgress", { game_id: opening.gameId, explorer_id: opening.explorerId });
        const result = progress && recoveredRelic(progress);
        recoverChestOpening(opening, result ?? null);
      });
    const stop = setup.store.subscribe(recover);
    recover();
    return () => {
      active = false;
      stop();
    };
  }, [moment, setup.store]);
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
      offer: relicOffer(progress, offer),
    },
  };
};

/** The contract grants quality + 1 levels; a lost story leaves the offer intact but no flavour name or token roll. */
const recoveredRelic = (progress: NativeRows["ArmyProgress"]): ChestResult | null => {
  const offer = progress.pending;
  if (offer?.source !== "Relic") return null;
  const quality = offer.amount - 1;
  if (quality !== 0 && quality !== 1 && quality !== 2 && quality !== 3) throw new Error("Unknown relic quality");
  return {
    outcome: { kind: "relic", intensity: quality },
    relic: { name: "Relic", offer: relicOffer(progress, offer) },
  };
};

const relicOffer = (
  progress: NativeRows["ArmyProgress"],
  offer: NonNullable<NativeRows["ArmyProgress"]["pending"]>,
) => ({
  amount: offer.amount,
  choices: offer.choices.map((attribute) => ({ attribute, level: attributeLevel(progress, attribute) })),
});
