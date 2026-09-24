import { readExplorers } from "@bibliothecadao/eternum";
import type { ID } from "@bibliothecadao/types";
import { useMemo } from "react";
import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "./use-native-facts";
import { getPlayerName } from "@/services/identity/player-profiles";
import { usePlayerNamesRevision } from "@/hooks/use-player-profile";

export const useExplorersByStructure = ({ structureEntityId }: { structureEntityId: ID }) => {
  const {
    setup: { store },
    account: { account },
  } = useGame();
  const revision = useNativeRevision(["ExplorerTroops", "Structure", "ResourceWeight", "EntityName", "TileOpt"]);
  const names = usePlayerNamesRevision();
  return useMemo(
    () => readExplorers(store, structureEntityId, BigInt(account.address), getPlayerName),
    [store, structureEntityId, account.address, revision, ...names],
  );
};
