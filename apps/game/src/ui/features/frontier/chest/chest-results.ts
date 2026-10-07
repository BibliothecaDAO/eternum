import { useGame } from "@/hooks/context/game-context";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { type ChestRewardSystemUpdate, configManager, WorldUpdateListener } from "@bibliothecadao/eternum";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { rowInGameSyncScope } from "@bibliothecadao/eternum/game-sync";
import { TileOccupier } from "@bibliothecadao/types";
import { useEffect } from "react";
import { isPlayersArmy } from "../frontier-home";
import { type ChestResult, recoverChestOpening, useChestMoment, resolveChestOpening } from "./chest-moment";
import { readChestOutcome } from "./chest-outcome";
import { relicName } from "./relic-name";

/**
 * The player's own chest results end the opening they tapped, from the story alone: a LORDS roll, or a relic and the
 * fixed XP it paid the army.
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
        // A lost story leaves nothing on the army to tell a relic from other XP, so the opening ends unnamed.
        recoverChestOpening(opening, null);
      });
    const stop = setup.store.subscribe(recover);
    recover();
    return () => {
      active = false;
      stop();
    };
  }, [moment, setup.store]);
};

/** The moment's result from a chest story and the game's rules. */
const readChestResult = (store: Pick<NativeFactStore, "require">, reward: ChestRewardSystemUpdate): ChestResult => {
  const gameId = configManager.getActiveGameId();
  const outcome = readChestOutcome(reward, store.require("ChestRules", { game_id: gameId }));
  if (outcome.kind === "lords") return { outcome };
  const xp = store.require("ArmyProgressionRules", { game_id: gameId }).fixed_xp;
  return { outcome, relic: { name: relicName(reward.resultKey), xp } };
};
