import { readExplorers } from "@bibliothecadao/eternum";
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
    "ExplorerTroops",
    "Structure",
    "ResourceWeight",
    "EntityName",
    "TileOccupancy",
  ]);
  const names = usePlayerNames();
  return useMemo(
    () => readExplorers(facts.store, structureEntityId, BigInt(account.address), names.text),
    [facts, structureEntityId, account.address, names],
  );
};
