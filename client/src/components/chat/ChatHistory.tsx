import { useEffect, useRef, useState } from "react";
import ChatMessage, { ChatMessageProps } from "../../elements/ChatMessage";
import Button from "../../elements/Button";
import { useChat } from "../../ChatContext";
import { addressToNumber } from "../../utils/utils";

interface ChatHistoryProps {
  messages: ChatMessageProps[];
}

const ChatHistory = (props: ChatHistoryProps) => {
  const [messageList, setMessageList] = useState<ChatMessageProps[]>([]);

  // this should be moved
  const [loadingMessages, setLoadingMessages] = useState<boolean>(false);

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messageList]);

  const { loginFlow, client, loading, loggedIn } = useChat();

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

  const setGroup = async (group: string) => {
    setLoadingMessages(true);

    await client?.channel.joinGroup(group);

    const { channelList } = client?.channel as any;

    console.log("channelList", channelList);
    const channel = channelList?.find((channel: any) => channel.chatid === group);

    await client?.channel.setActiveChannel(channel);
    await client?.channel.queryChannels({
      page: 1,
      size: 20,
    });
    await client?.message.getMessageList({
      page: 1,
      size: 20,
    });

    setLoadingMessages(false);
  };

  const transform = (s: string) => s.replace("user:", "0x").slice(0, 2) + "..." + s.slice(-3);

  const handleEvent = (event: { type: any }) => {
    const transformToAddress = (s: string) => s.replace("user:", "0x");

    const format = (message: any) => {
      return {
        sender: transform(message.senderId),
        message: message.content,
        avatar: `/images/avatars/${addressToNumber(transformToAddress(message.senderId))}.png`,
        timestamp: message.date,
      };
    };

    const list = client?.message.messageList;

    if (event.type === "channel.updated" || event.type == "message.getList") {
      console.log("message.getList", list);
      setMessageList(list?.map((message: any) => format(message)) || []);
    }
  };

  useEffect(() => {
    if (!client) return;
    client?.channel.queryChannels({ page: 1, size: 20 });
    client?.on("channel.activeChange", handleEvent);
    client?.on("channel.created", handleEvent);
    client?.on("message.delivered", handleEvent);
    client?.on("channel.getList", handleEvent);
    client?.on("message.getList", handleEvent);
    client?.on("channel.updated", handleEvent);
  }, [client]);

  const isLoading = loading || loadingMessages;

  return (
    <div className="relative flex flex-col h-full overflow-auto">
      <div className="sticky -m-2 z-10 top-0 left-0 w-full h-20 bg-gradient-to-b from-[#1B1B1B] to-transparent">
        &nbsp;
      </div>

      {isLoading && (
        <div className="absolute  h-full bg-black w-full text-white text-center flex justify-center">
          <div className="self-center">
            <img src="/images/eternum-logo_animated.png" className=" invert scale-50" />
          </div>
        </div>
      )}

      {!loggedIn && (
        <div className="my-2 w-full p-2 flex">
          <Button className="mx-auto" variant="outline" onClick={() => loginFlow()}>
            Connect
          </Button>
        </div>
      )}
      {loggedIn && !messageList.length && (
        <div className="my-2 w-full p-2 mx-auto flex">
          <Button className="mx-auto" variant="outline" onClick={() => setGroup(group)}>
            World Chat
          </Button>
        </div>
      )}

      {/* <Button onClick={() => createRoom('world')}>create</Button> */}

      {messageList.map((message, index) => (
        <ChatMessage key={index} {...message} />
      ))}

      {loggedIn && messageList && <span className="h-[0px]" ref={bottomRef}></span>}
    </div>
  );
};

export default ChatHistory;
