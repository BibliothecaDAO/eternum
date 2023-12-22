import { useEffect, useRef, useState } from "react";
import useWebSocket from "react-use-websocket";
import NpcChatMessage from "./NpcChatMessage";
import { NpcChatMessageProps } from "./NpcChatMessage";

interface NpcChatProps {
  spawned: number;
  realmId: bigint;
}

// Store chat history in this ;
const NpcChat = ({ spawned, realmId }: NpcChatProps) => {
  const chatIdentifier: string = `npc_chat_${realmId}`;
  const bottomRef = useRef<HTMLDivElement>(null);
  const [messageList, setMessageList] = useState<NpcChatMessageProps[]>(
    JSON.parse(window.localStorage.getItem(chatIdentifier) ?? ""),
  );
  const { sendJsonMessage, lastJsonMessage, readyState } = useWebSocket(import.meta.env.VITE_OVERLORE_WS_URL, {
    share: false,
    shouldReconnect: () => true,
  });

  // Runs when a new WebSocket message is received (lastJsonMessage)
  useEffect(() => {
    if (lastJsonMessage === null) {
      return;
    }
    let msgsArray: string[] = JSON.parse(JSON.stringify(lastJsonMessage, null, 2)).split("\n\n");
    if (msgsArray[msgsArray.length - 1] === "") msgsArray.pop();
    const newMessages = msgsArray.map((msg) => {
      const nameMsg = msg.split(":");
      return { sender: nameMsg[0], message: nameMsg[1] };
    });
    const newArray = [...messageList, ...newMessages];
    localStorage.setItem(chatIdentifier, JSON.stringify(newArray));
    setMessageList(newArray);
    setTimeout(() => {
      if (bottomRef.current) {
        bottomRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }, 1);
  }, [lastJsonMessage]);

  useEffect(() => {
    if (spawned === -1) {
      return;
    }

    sendJsonMessage({
      // Replace with this after demo version
      // user: realm.realm_id,
      user: 0,
      day: spawned,
    });
  }, [spawned]);

  useEffect(() => {
    console.log("Connection state changed");
  }, [readyState]);

  useEffect(() => {}, []);
  return (
    <div className="relative flex flex-col h-full overflow-auto">
      <div
        className={
          "relative flex flex-col h-full overflow-auto relative top-3 flex flex-col h-full center mx-auto w-[96%] mb-3 overflow-auto border border-gold"
        }
      >
        <>
          {messageList?.map((message, index) => {
            return <NpcChatMessage key={index} {...message} />;
          })}
          <span className="" ref={bottomRef}></span>
        </>
      </div>
    </div>
  );
};

export default NpcChat;
