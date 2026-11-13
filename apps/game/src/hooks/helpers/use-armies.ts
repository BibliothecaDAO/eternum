import type { ReadKeys } from "@bibliothecadao/eternum/game-client";
import { useCurrentDefaultTick } from "./use-block-timestamp";
import { currentArmy, readExplorers } from "@bibliothecadao/eternum";
import type { ID } from "@bibliothecadao/types";
import { useMemo } from "react";
import { useGame } from "@/hooks/context/game-context";
import { useNativeFacts } from "./use-native-facts";
import { usePlayerNames } from "@/hooks/use-player-profile";

export const useExplorersByStructure = ({ structureEntityId }: { structureEntityId: ID }) => {
  const {
    account: { account },
  } = useGame();
  const facts = useNativeFacts([
    "ArmySlot",
    "DeepArmy",
    "ArmyDay",
    "DeepRules",
    "ExplorerTroops",
    "Structure",
    "ResourceWeight",
    "EntityName",
    "TileOccupancy",
  ]);
  const names = usePlayerNames();
  useCurrentDefaultTick();
  return readExplorers(facts.store, structureEntityId, BigInt(account.address), names.text);
};

/** Army counts change on the confirmed tick even when no row is written. */
export function useCurrentArmy(key: ReadKeys<"ExplorerTroops"> | undefined) {
  const facts = useNativeFacts([
    "ExplorerTroops",
    "DeepArmy",
    "DeepRules",
    "ArmyDay",
    "SliceRules",
    "GameRegistry",
    "SettlementRules",
  ]);
  const timestamp = useCurrentDefaultTick();
  const game = key?.game_id;
  const explorer = key?.explorer_id;
  return useMemo(() => {
    const row =
      game === undefined || explorer === undefined
        ? undefined
        : facts.store.get("ExplorerTroops", { game_id: game, explorer_id: explorer });
    return row && currentArmy(facts.store, row, timestamp);
  }, [facts, game, explorer, timestamp]);
}
