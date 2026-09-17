import { readExplorers } from "@bibliothecadao/eternum";
import type { ID } from "@bibliothecadao/types";
import { useMemo } from "react";
import { useGame } from "../context";
import { useNativeRevision } from "./use-native-facts";

export const useExplorersByStructure = ({ structureEntityId }: { structureEntityId: ID }) => {
  const {
    setup: { store },
    account: { account },
  } = useGame();
  const revision = useNativeRevision([
    "ExplorerTroops",
    "Structure",
    "AgentOwner",
    "ResourceWeight",
    "AddressName",
    "TileOpt",
  ]);
  return useMemo(
    () => readExplorers(store, structureEntityId, BigInt(account.address)),
    [store, structureEntityId, account.address, revision],
  );
};
