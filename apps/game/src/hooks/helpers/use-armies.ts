import { readExplorers } from "@bibliothecadao/eternum";
import type { ID } from "@bibliothecadao/types";
import { useMemo } from "react";
import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "./use-native-facts";
import { usePlayerNames } from "@/hooks/use-player-profile";

export const useExplorersByStructure = ({ structureEntityId }: { structureEntityId: ID }) => {
  const {
    setup: { store },
    account: { account },
  } = useGame();
  const revision = useNativeRevision([
    "ArmySlot",
    "ExplorerTroops",
    "Structure",
    "ResourceWeight",
    "EntityName",
    "TileOccupancy",
  ]);
  const names = usePlayerNames();
  return useMemo(
    () => readExplorers(store, structureEntityId, BigInt(account.address), names.text),
    [store, structureEntityId, account.address, revision, names],
  );
};
