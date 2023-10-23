import { useEffect, useRef, useState } from "react";
import { random } from "@latticexyz/utils";
import { nameFromEntityId } from "./utils";
import { Npc } from "./types";
import NpcChatMessage from "./NpcChatMessage";
import GptInterface from "../../../../utils/NpcPrompt";
import { NpcChatMessageProps } from "./NpcChatMessage";
import { useNpcs } from "../../../../NpcContext";
import { Role } from "./constants";

interface NpcChatProps {
  npcs: Npc[];
  realmId: number;
}

// Store chat history in this ;
const NpcChat = ({ npcs, realmId }: NpcChatProps) => {
  const { genMsg, setGenMsg, type } = useNpcs();
  const chatIdentifier: string = `npc_chat_${realmId}`;

  const [messageList, setMessageList] = useState<NpcChatMessageProps[]>(
    JSON.parse(window.localStorage.getItem(chatIdentifier)),
  );

  //   Can remove this I think
  const [ready, setReady] = useState<boolean>(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const gptInterface = new GptInterface();

  useEffect(() => {
    const generateMessages = async () => {
      if (npcs.length == 0) {
        setGenMsg(false);
        return;
      }
      let npc;
      let systemMessage: NpcChatMessageProps = { sender: "Sytem message", message: "" };
      let harvest = true;
      // loading!
      if (type === "random") {
        // random is from the button
        npc = npcs[random(npcs.length - 1)];
        harvest = false;
      } else if (type === "farmer") {
        // this is from a harvest, so add a message before the actual villager's prompt
        const farmers = npcs.filter((npc) => npc.role === Role.Farmer);
        if (farmers.length === 0) {
          setGenMsg(false);
          let newMessages = messageList || [];
          systemMessage.message = `No farmer in your village can talk to you.`;
          newMessages.push(systemMessage);
          setMessageList(newMessages);
          window.localStorage.setItem(chatIdentifier, JSON.stringify(newMessages));
          return;
        }
        console.log(farmers);
        npc = farmers[random(farmers.length - 1)];
        console.log(npc);
        systemMessage.message = `You harvested wheat`;
      } else if (type === "miner") {
        // this is from a harvest
        const miners = npcs.filter((npc) => npc.role === Role.Miner);
        npc = miners[random(miners.length - 1)];
        systemMessage.message = `You mined`;
        if (miners.length !== 0) {
          setGenMsg(false);
          return;
        }
      }
      let response: Response;
      // call chatGTP here
      if (harvest) {
        response = await gptInterface.generateHarvestPrompt(npc);
      } else {
        response = await gptInterface.generateGreetingsPrompt(npc);
      }
      const data = await response.json();
      const generatedPrompt = data.choices[0].message.content.trim();

      const sender = nameFromEntityId(npc.entityId, npc.sex);

      let newMessages = messageList || [];

      if (systemMessage.message !== "") {
        newMessages.push(systemMessage);
      }

      newMessages.push({ message: generatedPrompt, sender });
      setMessageList(newMessages);

      window.localStorage.setItem(chatIdentifier, JSON.stringify(newMessages));

      setTimeout(() => {
        if (bottomRef.current) {
          bottomRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      }, 1);
      setGenMsg(false);
    };
    if (!genMsg) {
      return;
    }
    generateMessages();
  }, [genMsg]);

  useEffect(() => {
    setReady(true);
  }, []);

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

  useEffect(() => {}, []);
  return (
    <div className="relative flex flex-col h-full overflow-auto">
      <div className={"text-white text-xxs pr-2 mt-1"} style={{ position: "static", textAlign: "right" }}>
        NPCs: {npcs.length} / 5
      </div>

      <div
        className={
          "relative flex flex-col h-full overflow-auto relative top-3 flex flex-col h-full center mx-auto w-[96%] mb-3 overflow-auto border border-gold"
        }
      >
        {genMsg ? (
          <div className="absolute h-full bg-black w-[100%] text-white text-center flex justify-center">
            <div className="self-center">
              <img src="/images/eternum-logo_animated.png" className="invert scale-50" />
            </div>
          </div>
        ) : (
          <>
            {messageList?.map((message, index) => {
              return <NpcChatMessage key={index} {...message} />;
            })}
            {/* <div className="h-[30px] w-[30px] text-white text-center flex justify-center">
              <div className="self-center">
                <img src="/images/eternum-logo_animated.png" className="invert" />
              </div>
            </div> */}
            {/* <div className="flex flex-col px-2 mb-3 select-none py-1">
              <div className="flex items-center">
                <div className="flex flex-col w-full">
                  <div className="h-[30px] w-[30px] text-white text-center flex justify-center">
                    <div className="self-center">
                      <img src="/images/eternum-logo_animated.png" className="invert" />
                    </div>
                  </div>
                </div>
              </div>
            </div> */}

            <span className="" ref={bottomRef}></span>
          </>
        )}
      </div>
    </div>
  );
};

export default NpcChat;
