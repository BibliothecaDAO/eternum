import { createContext, useContext, ReactNode, useState } from "react";
import useRealmStore from "../../../../hooks/store/useRealmStore";
import { Npc } from "./types";
import { HasValue, getComponentValue, runQuery } from "@dojoengine/recs";
import { unpackCharacteristics } from "./utils";
import { shortString } from "starknet";
import { useDojo } from "../../../../DojoContext";

type NpcContextProps = {
  selectedTownhall: number | null;
  setSelectedTownhall: (newIndex: number | null) => void;
  lastMessageDisplayedIndex: number;
  setLastMessageDisplayedIndex: (newIndex: number) => void;
  loadingTownhall: boolean;
  setLoadingTownhall: (newValue: boolean) => void;
  npcs: Npc[];
};

type Props = {
  children: ReactNode;
};

const NpcContext = createContext<NpcContextProps | null>(null);

export const NpcProvider = ({ children }: Props) => {
  const currentContext = useContext(NpcContext);

  const {
    setup: {
      components: { Npc: NpcComponent },
    },
  } = useDojo();

  const { realmEntityId } = useRealmStore();

  if (currentContext) throw new Error("NpcProvider can only be used once");
  const [selectedTownhall, setSelectedTownhall] = useState<number | null>(null);
  const [lastMessageDisplayedIndex, setLastMessageDisplayedIndex] = useState(0);
  const [loadingTownhall, setLoadingTownhall] = useState<boolean>(false);

  const contextValue: NpcContextProps = {
    selectedTownhall,
    setSelectedTownhall,
    lastMessageDisplayedIndex,
    setLastMessageDisplayedIndex,
    loadingTownhall,
    setLoadingTownhall,
    npcs: getNpcs(realmEntityId, NpcComponent),
  };
  return <NpcContext.Provider value={contextValue}>{children}</NpcContext.Provider>;
};

const getNpcs = (realmEntityId: BigInt, NpcComponent: any): Npc[] => {
  const entityIds = runQuery([HasValue(NpcComponent, { realm_id: realmEntityId })]);
  let npcs: Npc[] = Array.from(entityIds).map((entityId) => {
    let npc = getComponentValue(NpcComponent, entityId);

    return {
      entityId: entityId,
      realmId: npc!.realm_id,
      characteristics: unpackCharacteristics(npc!.characteristics),
      characterTrait: shortString.decodeShortString(String(npc!.character_trait)),
      name: shortString.decodeShortString(String(npc!.name)),
    };
  });
  return npcs;
};

export const useNpcContext = () => {
  const context = useContext(NpcContext);
  if (!context) throw new Error("Must be used within a NpcProvider");
  return context;
};
