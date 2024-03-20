import { createContext, useContext, ReactNode, useState, useEffect } from "react";
import useRealmStore from "../../../../hooks/store/useRealmStore";
import { WsResponse, WsMsgType, ErrorResponse } from "./types";
import useWebSocket from "react-use-websocket";
import { SendJsonMessage } from "react-use-websocket/dist/lib/types";
import { keysSnakeToCamel } from "./utils";

type NpcContextProps = {
  sendWsMsg: SendJsonMessage;
  lastWsMsg: WsResponse;
  selectedTownhall: number | null;
  setSelectedTownhall: (newIndex: number | null) => void;
  lastMessageDisplayedIndex: number;
  setLastMessageDisplayedIndex: (newIndex: number) => void;
  loadingTownhall: boolean;
  setLoadingTownhall: (newValue: boolean) => void;
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
    sendJsonMessage: sendWsMsg,
    lastJsonMessage: lastWsMsg,
    readyState: wsReadyState,
  } = useWebSocket(import.meta.env.VITE_OVERLORE_WS_URL, {
    share: false,
    shouldReconnect: () => true,
  });

  const { realmId } = useRealmStore();
  const LOCAL_STORAGE_ID: string = `npc_chat_${realmId}`;

  const [selectedTownhall, setSelectedTownhall] = useState<number | null>(null);
  const [lastMessageDisplayedIndex, setLastMessageDisplayedIndex] = useState(0);
  const [loadingTownhall, setLoadingTownhall] = useState<boolean>(false);

  useEffect(() => {
    if (lastWsMsg === null || lastWsMsg === undefined || Object.is(lastWsMsg, {})) {
      return;
    }
    const response = keysSnakeToCamel(lastWsMsg) as WsResponse;
    const msg_type = response.msgType;
    if (msg_type === WsMsgType.ERROR) {
      console.log(`Failure in lore machine: ${(response.data as ErrorResponse).reason}`);
    }
  }, [lastWsMsg]);

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
    LOCAL_STORAGE_ID,
  };
  return <NpcContext.Provider value={contextValue}>{children}</NpcContext.Provider>;
};

export const useNpcContext = () => {
  const context = useContext(NpcContext);
  if (!context) throw new Error("Must be used within a NpcProvider");
  return context;
};
