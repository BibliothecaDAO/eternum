import { useEffect, useRef, useState } from "react";
import ChatMessage, { ChatMessageProps } from "../../../../elements/ChatMessage";
import Button from "../../../../elements/Button";

type NpcClient = {
  mood: Number;
  role: Number;
  sex: Number;
  realm_id: Number;
};

interface NpcChatProps {
  npcs: NpcClient[];
}

const NpcChat = ({ npcs }: NpcChatProps) => {
  const [messageList, setMessageList] = useState<ChatMessageProps[]>([]);

  // this should be moved
  const [loadingMessages, setLoadingMessages] = useState<boolean>(false);

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messageList]);

  // Temp world chat
  const group = "group:aaa83cddb7d563d2847d56247060cec696f3d425";

  // const createRoom = async (groupName: string) => {
  //     client?.channel.createRoom({
  //         groupName, permissions: {
  //             "group:join": {
  //                 type: "enum",
  //                 value: "public"
  //             }
  //         }
  //     })
  // }

  const transform = (s: string) => s.replace("user:", "").slice(0, 2) + "..." + s.slice(-3);

  useEffect(() => {}, []);

  return (
    <div className="relative top-3 flex flex-col h-full center mx-auto w-[96%] mb-3 overflow-auto border border-gold">
      <div className={"text-white text-xxs right-0 pr-3 mt-2"} style={{ textAlign: "right" }}>
        NPCs: {npcs.length} / ??
      </div>
      &nbsp;
      {messageList.map((message, index) => (
        <ChatMessage key={index} {...message} />
      ))}
      {/* <Button onClick={() => createRoom('world')}>create</Button> */}
    </div>
  );
};

export default NpcChat;
