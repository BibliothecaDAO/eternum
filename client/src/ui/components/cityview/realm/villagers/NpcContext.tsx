import { createContext, useContext, ReactNode, useState, useMemo } from "react";
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
  spawned: number;
  setSpawned: (newNumber: number) => void;
  LOCAL_STORAGE_ID: string;
};

type Props = {
  children: ReactNode;
};

const NpcContext = createContext<NpcContextProps | null>(null);

export const NpcProvider = ({ children }: Props) => {
  const currentContext = useContext(NpcContext);
  if (currentContext) throw new Error("NpcProvider can only be used once");

  const {
    setup: {
      components: { Npc: NpcComponent },
    },
  } = useDojo();

  const { realmEntityId, realmId } = useRealmStore();
  const LOCAL_STORAGE_ID: string = `npc_chat_${realmId}`;

  const [selectedTownhall, setSelectedTownhall] = useState<number | null>(null);
  const [lastMessageDisplayedIndex, setLastMessageDisplayedIndex] = useState(0);
  const [loadingTownhall, setLoadingTownhall] = useState<boolean>(false);
  const [spawned, setSpawned] = useState(0);

  const npcs = useMemo(() => {
    return getNpcs(realmEntityId, NpcComponent);
  }, [realmEntityId, spawned]);

  const contextValue: NpcContextProps = {
    selectedTownhall,
    setSelectedTownhall,
    lastMessageDisplayedIndex,
    setLastMessageDisplayedIndex,
    loadingTownhall,
    setLoadingTownhall,
    npcs,
    spawned,
    setSpawned,
    LOCAL_STORAGE_ID,
  };
  return <NpcContext.Provider value={contextValue}>{children}</NpcContext.Provider>;
};

const getNpcs = (realmEntityId: BigInt, NpcComponent: any): Npc[] => {
  const entityIds = runQuery([HasValue(NpcComponent, { realm_entity_id: realmEntityId })]);
  let npcs: Npc[] = Array.from(entityIds).map((entityId) => {
    let npc = getComponentValue(NpcComponent, entityId);
    return {
      entityId: entityId,
      realmEntityId: BigInt(npc!.realm_entity_id),
      characteristics: unpackCharacteristics(npc!.characteristics),
      characterTrait: shortString.decodeShortString(npc!.character_trait.toString()),
      fullName: shortString.decodeShortString(npc!.full_name.toString()),
    };
  });
  return npcs;
};

export const useNpcContext = () => {
  const context = useContext(NpcContext);
  if (!context) throw new Error("Must be used within a NpcProvider");
  return context;
};
