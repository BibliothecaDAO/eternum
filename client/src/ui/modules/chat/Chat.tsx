import { useDojo } from "@/hooks/context/DojoContext";
import { useGetAllPlayers } from "@/hooks/helpers/useEntities";
import TextInput from "@/ui/elements/TextInput";
import { useEntityQuery } from "@dojoengine/react";
import { getComponentValue, Has, HasValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useCallback, useEffect, useRef, useState } from "react";
import { shortString, TypedData } from "starknet";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/elements/Select";
import { toValidAscii } from "@/ui/utils/utils";
import { MESSAGE_COLORS } from "./constants";

const GLOBAL_CHANNEL = shortString.encodeShortString("global");

function generateMessageTypedData(
  identity: string,
  channel: string,
  content: string,
  salt: string,
  timestamp = Date.now(),
) {
  return {
    types: {
      StarknetDomain: [
        { name: "name", type: "shortstring" },
        { name: "version", type: "shortstring" },
        { name: "chainId", type: "shortstring" },
        { name: "revision", type: "shortstring" },
      ],
      "eternum-Message": [
        { name: "identity", type: "ContractAddress" },
        { name: "channel", type: "shortstring" },
        { name: "content", type: "string" },
        { name: "salt", type: "felt" },
      ],
    },
    primaryType: "eternum-Message",
    domain: {
      name: "Eternum",
      version: "1",
      chainId: "1",
      revision: "1",
    },
    message: {
      identity,
      channel,
      content,
      salt,
      timestamp,
    },
  };
}

export const Chat = () => {
  const {
    account: { account },
    setup: {
      components: { Message, AddressName },
    },
    network: { toriiClient },
  } = useDojo();

  const bottomChatRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<
    { name: string; content: string; color: string; isDirect: boolean; fromSelf: boolean; timestamp: Date }[]
  >([]);
  const [content, setContent] = useState<string>("");
  const [channel, setChannel] = useState<string>("");
  const [salt, setSalt] = useState<bigint>(0n);
  const [flashMessageIndex, setFlashMessageIndex] = useState<number | null>(null);

  const getColorForAddress = (address: string) => {
    const hash = address.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return MESSAGE_COLORS[hash % MESSAGE_COLORS.length];
  };

  const allMessageEntities = useEntityQuery([Has(Message)]);

  const selfMessageEntities = useEntityQuery([Has(Message), HasValue(Message, { identity: BigInt(account.address) })]);
  const receivedMessageEntities = useEntityQuery([
    Has(Message),
    HasValue(Message, { channel: BigInt(account.address) }),
  ]);
  const recipientEntities = useEntityQuery([
    Has(AddressName),
    HasValue(AddressName, { name: BigInt(!channel ? "0x0" : shortString.encodeShortString(channel)) }),
  ]);

  useEffect(() => {
    scrollToElement(bottomChatRef);
  }, [allMessageEntities, receivedMessageEntities]);

  useEffect(() => {
    const globalMessages = allMessageEntities
      .filter((entity) => {
        const message = getComponentValue(Message, entity);

        const isGlobal = message?.channel === BigInt(GLOBAL_CHANNEL);
        const isDirect = message?.channel === BigInt(account.address);
        const fromSelf = message?.identity === BigInt(account.address);
        return isGlobal || isDirect || fromSelf;
      })
      .map((entity) => {
        const message = getComponentValue(Message, entity);
        const address = `0x${message?.identity.toString(16)}`;
        const addressName = getComponentValue(AddressName, getEntityIdFromKeys([BigInt(address)]));
        const name = shortString.decodeShortString(addressName?.name.toString() || "") || "Unknown";
        const content = !!message?.content ? message.content : "";
        const color = getColorForAddress(address);
        const timestamp = new Date(Number(message?.timestamp));

        const isDirect = message?.channel === BigInt(account.address);
        return {
          name,
          content,
          color,
          isDirect,
          fromSelf: message?.identity === BigInt(account.address),
          timestamp,
        };
      })
      .sort((a, b) => Number(a.timestamp) - Number(b.timestamp)); // Sort messages by timestamp

    setMessages((prevMessages) => {
      const newMessages = [...globalMessages];
      if (newMessages.length > prevMessages.length) {
        setFlashMessageIndex(newMessages.length - 1);
        setTimeout(() => setFlashMessageIndex(null), 1000);
      }
      return newMessages;
    });
  }, [allMessageEntities, receivedMessageEntities]);

  useEffect(() => {
    const salts = selfMessageEntities.map((entity) => {
      const message = getComponentValue(Message, entity);
      return message?.salt || 0n;
    });
    if (!salts.length) return;
    setSalt(salts.sort((a, b) => Number(b) - Number(a))[0] + 1n);
  }, [selfMessageEntities, salt]);

  const publish = useCallback(
    async (message: string) => {
      const recipientAddress = !!recipientEntities.length
        ? getComponentValue(AddressName, recipientEntities[0])?.address
        : "";

      const channel = !!recipientAddress ? `0x${recipientAddress.toString(16)}` : GLOBAL_CHANNEL;

      const messageInValidAscii = toValidAscii(message);
      const data = generateMessageTypedData(account.address, channel, messageInValidAscii, `0x${salt?.toString(16)}`);

      const signature: any = await account.signMessage(data as TypedData);

      await toriiClient.publishMessage(JSON.stringify(data), [
        `0x${signature.r.toString(16)}`,
        `0x${signature.s.toString(16)}`,
      ]);
    },
    [account, recipientEntities, salt, toriiClient],
  );

  const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      publish(content);
      setContent("");
    }
    // clear
  };

  const getPlayers = useGetAllPlayers();
  const players = getPlayers().filter((player) => player.address !== BigInt(account.address));
  return (
    <div
      className="flex flex-col gap-2 w-72 border bg-black/40 p-1 border-gold/40 bg-hex-bg bottom-0 rounded max-h-72"
      style={{ zIndex: 100 }}
    >
      <div className="border p-2 border-gold/40 rounded text-xs max-h-60 overflow-y-auto">
        {messages.map((message, index) => (
          <div
            style={{ color: message.color }}
            className={`flex gap-2 ${index === flashMessageIndex ? "animate-flash" : ""}`}
            key={index}
          >
            <div className="flex flex-row opacity-70">
              <p className="text-xs opacity-70 mr-2">{message.timestamp.toLocaleTimeString()}</p>
              <p className="font-bold mr-2">{message.isDirect ? `From ${message.name} ` : `${message.name} `}</p>
              <p className="">{message.content}</p>
            </div>
          </div>
        ))}
        <span className="" ref={bottomChatRef}></span>
      </div>

      <Select
        value={channel}
        onValueChange={(trait) => {
          setChannel(trait);
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select Player or Global" />
        </SelectTrigger>
        <SelectContent>
          {players &&
            players.map((player, index) => (
              <SelectItem className="flex justify-between" key={index} value={player.addressName || "  "}>
                {player.addressName}
              </SelectItem>
            ))}
          <SelectItem className="flex justify-between" value="Global">
            Global
          </SelectItem>
        </SelectContent>
      </Select>
      <TextInput
        className="border border-gold/40  !w-auto  text-gold"
        placeholder="Message"
        value={content}
        onChange={setContent}
        onKeyPress={handleKeyPress}
      />
    </div>
  );
};

export const scrollToElement = (ref: React.RefObject<HTMLDivElement>) => {
  setTimeout(() => {
    if (ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, 1);
};
