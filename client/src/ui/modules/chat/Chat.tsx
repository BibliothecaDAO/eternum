import { useDojo } from "@/hooks/context/DojoContext";
import { useGetAllPlayers } from "@/hooks/helpers/useEntities";
import TextInput from "@/ui/elements/TextInput";
import { useEntityQuery } from "@dojoengine/react";
import { getComponentValue, Has, HasValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { shortString, TypedData } from "starknet";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/elements/Select";
import { toHexString, toValidAscii } from "@/ui/utils/utils";
import { ContractAddress } from "@bibliothecadao/eternum";
import { ChatTab, DEFAULT_TAB, getMessageKey, Tab } from "./ChatTab";
import { PASTEL_BLUE, PASTEL_PINK } from "./constants";

interface ChatMessage {
  address: string;
  name: string;
  content: string;
  fromSelf: boolean;
  timestamp: Date;
}

const GLOBAL_CHANNEL = shortString.encodeShortString("global");
const CHAT_STORAGE_KEY = "chat_tabs";

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
        { name: "timestamp", type: "felt" },
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
      timestamp,
      salt,
    },
  };
}

export const Chat = () => {
  const {
    masterAccount,
    account: { account },
    setup: {
      components: { Message, AddressName },
    },
    network: { toriiClient },
  } = useDojo();

  const getPlayers = useGetAllPlayers();
  const players = getPlayers().filter((player) => ContractAddress(player.address) !== ContractAddress(account.address));

  const [currentTab, setCurrentTab] = useState<Tab>(DEFAULT_TAB);
  const [tabs, setTabs] = useState<Tab[]>([]);

  const storedTabs = useMemo(() => {
    return [...JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY + account.address) || "[]")];
  }, [account.address]);

  useEffect(() => {
    if (account.address === masterAccount.address) return;

    if (storedTabs.length === 0) {
      console.log("here");
      setNewTabs([DEFAULT_TAB]);
    } else {
      setTabs([...storedTabs]);
    }
  }, [storedTabs]);

  const bottomChatRef = useRef<HTMLDivElement>(null);

  const [content, setContent] = useState<string>("");

  const [salt, setSalt] = useState<bigint>(0n);

  const allMessageEntities = useEntityQuery([Has(Message)]);

  const selfMessageEntities = useEntityQuery([Has(Message), HasValue(Message, { identity: BigInt(account.address) })]);
  const receivedMessageEntities = useEntityQuery([
    Has(Message),
    HasValue(Message, { channel: BigInt(account.address) }),
  ]);

  const recipientEntities = useEntityQuery([Has(AddressName), HasValue(AddressName, { name: BigInt("0x0") })]);

  useEffect(() => {
    scrollToElement(bottomChatRef);
  }, [allMessageEntities, receivedMessageEntities]);

  const setNewTabs = (newTabs: Tab[]) => {
    setTabs(newTabs);
    console.log(newTabs);
    localStorage.setItem(CHAT_STORAGE_KEY + account.address, JSON.stringify(newTabs));
  };

  const messages = useMemo(() => {
    const messageMap = new Map<ContractAddress, ChatMessage[]>();

    allMessageEntities
      .filter((entity) => {
        const message = getComponentValue(Message, entity);
        if (!message) return false;

        const address = `0x${message?.identity.toString(16)}`;
        const addressName = getComponentValue(AddressName, getEntityIdFromKeys([BigInt(address)]));
        if (!addressName) return false;

        const fromSelf = message?.identity === BigInt(account.address);

        if (fromSelf) return true;

        return (
          message.identity === BigInt(account.address) ||
          message.channel === BigInt(account.address) ||
          message.channel === BigInt(GLOBAL_CHANNEL)
        );
      })
      .forEach((entity) => {
        const message = getComponentValue(Message, entity);

        if (!message) return;

        const senderAddress = toHexString(message.identity);

        const senderName = getComponentValue(AddressName, getEntityIdFromKeys([BigInt(senderAddress)]));
        const name = shortString.decodeShortString(senderName?.name.toString() || "") || "Unknown";
        const content = !!message.content ? message.content : "";
        const timestamp = new Date(Number(message.timestamp));

        const sortedAddressesHash = getMessageKey(message.identity, message.channel);

        const key = message.channel === BigInt(GLOBAL_CHANNEL) ? GLOBAL_CHANNEL : sortedAddressesHash;

        if (!messageMap.has(ContractAddress(key))) {
          messageMap.set(ContractAddress(key), []);
        }

        messageMap.get(ContractAddress(key))?.push({
          address: senderAddress,
          name,
          content,
          fromSelf: message.identity === BigInt(account.address),
          timestamp,
        });
      });

    messageMap.forEach((messages, _) => {
      messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    });

    return messageMap;
  }, [allMessageEntities, receivedMessageEntities]);

  const messagesToDisplay = useMemo(() => {
    if (currentTab.name === "Global") {
      return messages.get(BigInt(GLOBAL_CHANNEL));
    }

    const sortedAddressesHash = getMessageKey(currentTab.address, account.address);

    return messages.get(ContractAddress(sortedAddressesHash));
  }, [messages, currentTab.address]);

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
        : currentTab.name === "Global"
        ? undefined
        : BigInt(currentTab.address);

      const channel = !!recipientAddress ? `0x${recipientAddress.toString(16)}` : GLOBAL_CHANNEL;

      const messageInValidAscii = toValidAscii(message);
      const data = generateMessageTypedData(account.address, channel, messageInValidAscii, `0x${salt?.toString(16)}`);

      const signature: any = await account.signMessage(data as TypedData);

      await toriiClient.publishMessage(JSON.stringify(data), [
        `0x${signature.r.toString(16)}`,
        `0x${signature.s.toString(16)}`,
      ]);
    },
    [account, recipientEntities, salt, toriiClient, currentTab.address],
  );

  const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      publish(content);
      setContent("");
    }
  };

  const changeTabs = (tab: string | undefined, address: string, fromSelector: boolean = false) => {
    if (ContractAddress(address) === ContractAddress(account.address)) {
      return;
    }

    if (address === "Global") {
      setCurrentTab(DEFAULT_TAB);
      return;
    }

    if (fromSelector) {
      tab = shortString.decodeShortString(
        getComponentValue(AddressName, getEntityIdFromKeys([BigInt(address)]))?.name.toString() || "",
      );
    }

    const sortedAddressesHash = getMessageKey(BigInt(address), account.address);
    const key = address === "Global" ? GLOBAL_CHANNEL : sortedAddressesHash;
    const numberOfMessages =
      messages.get(ContractAddress(address))?.filter((message) => message.fromSelf === false).length || 0;

    const currentTab = {
      name: tab!,
      address,
      numberOfMessages,
      displayed: true,
    };

    setCurrentTab(currentTab);

    const selectedTab = tabs.find((tab) => ContractAddress(tab.address) === ContractAddress(address));
    const newTabs = [...tabs];

    if (!selectedTab) {
      newTabs.push(currentTab);
    } else if (!selectedTab?.displayed) {
      newTabs.map((tab) => {
        if (tab.address === address) {
          tab.displayed = true;
        }
        return tab;
      });
    }
    setNewTabs(newTabs);
  };

  const removeTab = (address: string) => {
    const newTabs = tabs.map((tab) => (tab.address === address ? { ...tab, displayed: false } : tab));

    setCurrentTab(DEFAULT_TAB);

    setNewTabs(newTabs);
  };

  return (
    <div className="rounded max-w-[28vw]" style={{ zIndex: 100 }}>
      <div className="flex flex-row overflow-x-auto max-w-full no-scrollbar h-8 items-end">
        {tabs
          .filter((tab) => tab.displayed)
          .map((tab) => (
            <ChatTab
              key={tab.address}
              tab={tab}
              changeTabs={changeTabs}
              selected={tab.name === currentTab.name}
              removeTab={removeTab}
            />
          ))}
      </div>
      <div className="flex flex-col gap-2 w-[28vw] border bg-black/40 p-1 border-gold/40 bg-hex-bg bottom-0 rounded-b max-h-80">
        <div className="border p-2 border-gold/40 rounded text-xs h-60 overflow-y-auto min-h-40">
          {messagesToDisplay?.map((message, index) => (
            <div
              style={{ color: currentTab.name === "Global" ? PASTEL_PINK : PASTEL_BLUE }}
              className={`flex gap-2 mb-1`}
              key={index}
            >
              <div className="opacity-70">
                <span className="font-bold mr-1 inline" onClick={() => changeTabs(message.name, message.address)}>
                  [{message.fromSelf ? "you" : message.name}]:
                </span>
                <span className="font-bold mr-2 inline">{`${message.content}`}</span>
              </div>
            </div>
          ))}
          <span className="" ref={bottomChatRef}></span>
        </div>

        <Select
          value={""}
          onValueChange={(trait) => {
            changeTabs(undefined, trait, true);
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select Player or Global" />
          </SelectTrigger>
          <SelectContent>
            {players &&
              players.map((player, index) => (
                <SelectItem className="flex justify-between" key={index} value={`0x${player.address.toString(16)}`}>
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
    </div>
  );
};

const scrollToElement = (ref: React.RefObject<HTMLDivElement>) => {
  setTimeout(() => {
    if (ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, 1);
};
