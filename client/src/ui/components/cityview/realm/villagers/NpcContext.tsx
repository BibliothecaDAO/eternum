import { createContext, useContext, ReactNode, useState, useMemo, useEffect } from "react";
import useRealmStore from "../../../../hooks/store/useRealmStore";
import { Npc, WsResponse } from "./types";
import { HasValue, getComponentValue, runQuery } from "@dojoengine/recs";
import { unpackCharacteristics } from "./utils";
import { shortString } from "starknet";
import { useDojo } from "../../../../DojoContext";
import useWebSocket from "react-use-websocket";
import { SendJsonMessage } from "react-use-websocket/dist/lib/types";
import { getEntityIdFromKeys } from "@dojoengine/utils";

type NpcContextProps = {
  sendWsMsg: SendJsonMessage;
  lastWsMsg: WsResponse;
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
      components: { Npc: NpcComponent, Npcs: NpcsComponent },
    },
  } = useDojo();

  const {
    sendJsonMessage: sendWsMsg,
    lastJsonMessage: lastWsMsg,
    readyState: wsReadyState,
  } = useWebSocket(import.meta.env.VITE_OVERLORE_WS_URL, {
    share: false,
    shouldReconnect: () => true,
  });

  const { realmEntityId, realmId } = useRealmStore();
  const LOCAL_STORAGE_ID: string = `npc_chat_${realmId}`;

  const [selectedTownhall, setSelectedTownhall] = useState<number | null>(null);
  const [lastMessageDisplayedIndex, setLastMessageDisplayedIndex] = useState(0);
  const [loadingTownhall, setLoadingTownhall] = useState<boolean>(false);
  const [spawned, setSpawned] = useState(0);

  const npcs = useMemo(() => {
    return getNpcs(realmEntityId, NpcComponent, NpcsComponent);
  }, [realmEntityId, spawned]);

  useEffect(() => {
    console.log(`Connection state changed ${wsReadyState}`);
  }, [wsReadyState]);

  const contextValue: NpcContextProps = {
    sendWsMsg,
    lastWsMsg: lastWsMsg as WsResponse,
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

const getNpcs = (realmEntityId: BigInt, NpcComponent: any, NpcsComponent: any): Npc[] => {
  const npcsEntityId = runQuery([HasValue(NpcsComponent, { realm_entity_id: realmEntityId })]);
  const npcsEntity = getComponentValue(NpcsComponent, npcsEntityId.values().next().value);
  if (npcsEntity === undefined) {
    return [];
  }

  let npcs: Npc[] = [];
  for (let i = 0; i < 5; i++) {
    let npcKey = `npc_${i}`;
    if (npcsEntity[npcKey] !== 0n) {
      const npcEntity = getComponentValue(NpcComponent, getEntityIdFromKeys([npcsEntity[npcKey]]));
      npcs.push({
        entityId: npcEntity!.entity_id,
        characteristics: unpackCharacteristics(npcEntity!.characteristics),
        characterTrait: shortString.decodeShortString(npcEntity!.character_trait.toString()),
        fullName: shortString.decodeShortString(npcEntity!.full_name.toString()),
      });
    }
  }
  return npcs;
};

export const useNpcContext = () => {
  const context = useContext(NpcContext);
  if (!context) throw new Error("Must be used within a NpcProvider");
  return context;
};
