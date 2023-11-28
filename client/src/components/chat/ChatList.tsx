import { useEffect } from "react";
import { useChat } from "../../ChatContext";
import Button from "../../elements/Button";


const ChatList = () => {

  // this should be moved

  // const bottomRef = useRef<HTMLDivElement>(null);

  const { loginFlow, client, loading, loggedIn } = useChat();



  const handleEvent = (event: { type: any }) => {

    const list = client?.channel.channelList;

    if (event.type === "channel.updated" || event.type == "channel.getList") {
      console.log("message.getList", list);
      // setGuildList(list?.map((message: any) => format(message)) || []);
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

  const isLoading = loading;

  return (
    <div className="relative flex flex-col h-full overflow-auto">
      <div>
        chat list
      </div>
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

      {/*{loggedIn && !guildList.length && (*/}
      {/*  <div className="my-2 w-full p-2 mx-auto flex">*/}
      {/*    <Button className="mx-auto" variant="outline" onClick={createGuild}>*/}
      {/*      Create Guild*/}
      {/*    </Button>*/}
      {/*  </div>*/}
      {/*)}*/}

      {/*/!* <Button onClick={() => createRoom('world')}>create</Button> *!/*/}

      {/*{guildList.map((guild, index) => (*/}
      {/*  <Channel key={index} {...guild} />*/}
      {/*))}*/}

      {/*/!*{loggedIn && chann && <span className="h-[0px]" ref={bottomRef}></span>}*!/*/}
    </div>
  );
};

export default ChatList;
