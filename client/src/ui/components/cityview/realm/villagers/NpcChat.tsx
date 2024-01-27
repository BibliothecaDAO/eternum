import { useEffect } from "react";
import useWebSocket from "react-use-websocket";
import NpcChatMessage from "./NpcChatMessage";
import { TownhallRecord, Message, NpcChatProps } from "./types"

const NpcChat = ({ spawned, realmId, selectedTownhall, setSelectedTownhall }: NpcChatProps) => {
  const chatIdentifier: string = `npc_chat_${realmId}`;
  const { sendJsonMessage, lastJsonMessage, readyState } = useWebSocket(import.meta.env.VITE_OVERLORE_WS_URL, {
    share: false,
    shouldReconnect: () => true,
  });
  
  // Runs when a new WebSocket message is received (lastJsonMessage)
  useEffect(() => {
    if (lastJsonMessage === null) {
      return;
    }
    
    const message: Message = lastJsonMessage as Message;
    const townhallKey = Object.keys(message)[0];         
    const townhallDiscussion: string[] = (message[townhallKey]).split("\n");
    
    if (townhallDiscussion[townhallDiscussion.length - 1] === "") {
      townhallDiscussion.pop();
    }
    
    const discussionsByNpc = townhallDiscussion.map((msg) => {
      const splitMessage = msg.split(":");
      return { npcName: splitMessage[0], dialogueSegment: splitMessage[1] };
    });
    
    
    const newEntry: TownhallRecord = {};
    newEntry[townhallKey] = discussionsByNpc;
    
    const townhallsInLocalStorage = localStorage.getItem(chatIdentifier);
    if (townhallsInLocalStorage) {
      const storedTownhalls: TownhallRecord = JSON.parse(townhallsInLocalStorage);
      storedTownhalls[townhallKey] = discussionsByNpc;
      localStorage.setItem(chatIdentifier, JSON.stringify(storedTownhalls));
    } else {
      localStorage.setItem(chatIdentifier, JSON.stringify(newEntry));
    }
    setSelectedTownhall(townhallKey); 
  }, [lastJsonMessage]);

  useEffect(() => {
    if (spawned === -1) {
      return;
    }

    sendJsonMessage({
      realm_id: realmId.toString(),
    });
  }, [spawned]);

  useEffect(() => {
    console.log("Connection state changed");
  }, [readyState]);

  useEffect(() => {}, []);
  return (
    <div className="relative flex flex-col h-full overflow-auto">
      <div
        className="relative flex flex-col h-full overflow-auto relative top-3 flex flex-col h-full center mx-auto w-[96%] mb-3 overflow-auto border border-gold"
      >
        <>
        {
          (() => {
            const townhallsInLocalStorage = JSON.parse(localStorage.getItem(chatIdentifier) ?? "{}");
            const townhallDiscussion = selectedTownhall ? townhallsInLocalStorage[selectedTownhall] : null;
            if (townhallDiscussion && townhallDiscussion.length) {
              return townhallDiscussion.map((message: any, index: number) => (
                <NpcChatMessage key={index} {...message} />
              ));
            } else {
              return <div>No messages available</div>;
            }
          })()
        }  
        </>
      </div>
    </div>
  );
};

export default NpcChat;
