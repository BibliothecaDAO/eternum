import { ReactComponent as Minimize } from "@/assets/icons/common/minimize.svg";
import { useDojo } from "@/hooks/context/DojoContext";
import { useGetOtherPlayers } from "@/hooks/helpers/useGetAllPlayers";
import { useEntityQuery } from "@dojoengine/react";
import { getComponentValue, Has, HasValue, runQuery } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useEffect, useMemo, useRef, useState } from "react";
import { shortString } from "starknet";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/elements/Select";
import { toHexString } from "@/ui/utils/utils";
import { ContractAddress } from "@bibliothecadao/eternum";
import { useChatStore } from "./ChatState";
import { ChatTab, DEFAULT_TAB } from "./ChatTab";
import { GLOBAL_CHANNEL, GLOBAL_CHANNEL_KEY, PASTEL_BLUE, PASTEL_PINK } from "./constants";
import { InputField } from "./InputField";
import { ChatMetadata, Tab } from "./types";
import { getMessageKey } from "./utils";

export const Chat = () => {
  const {
    account: { account },
    setup: {
      components: { Message, AddressName },
    },
  } = useDojo();

  const bottomChatRef = useRef<HTMLDivElement>(null);

  const [hideChat, setHideChat] = useState(false);
  const [salt, setSalt] = useState<bigint>(0n);

  const currentTab = useChatStore((state) => state.currentTab);
  const setCurrentTab = useChatStore((state) => state.setCurrentTab);
  const tabs = useChatStore((state) => state.tabs);
  const setTabs = useChatStore((state) => state.setTabs);

  const addTab = useChatStore((state) => state.addTab);

  const allMessageEntities = useEntityQuery([Has(Message)]);
  const getPlayers = useGetOtherPlayers();

  const players = useMemo(() => {
    return getPlayers();
  }, []);

  const messages = useMemo(() => {
    const messageMap = new Map<ContractAddress, ChatMetadata>();

    allMessageEntities.forEach((entity) => {
      const message = getComponentValue(Message, entity);
      if (!message) return;

      const address = toHexString(message.identity);
      const addressName = getComponentValue(AddressName, getEntityIdFromKeys([ContractAddress(address)]));
      if (!addressName) return;

      const fromSelf = message.identity === BigInt(account.address);
      const isRelevantMessage =
        fromSelf ||
        BigInt(message.channel) === BigInt(account.address) ||
        BigInt(message.channel) === BigInt(GLOBAL_CHANNEL);

      if (!isRelevantMessage) return;

      const senderName = getComponentValue(AddressName, getEntityIdFromKeys([BigInt(address)]));
      const name = shortString.decodeShortString(senderName?.name.toString() || "") || "Unknown";
      const content = message.content || "";
      const timestamp = new Date(Number(message.timestamp));
      const identity = message.identity;
      const channel = message.channel;

      const key =
        BigInt(message.channel) === BigInt(GLOBAL_CHANNEL)
          ? GLOBAL_CHANNEL
          : getMessageKey(identity, BigInt(message.channel));

      if (!messageMap.has(ContractAddress(key))) {
        messageMap.set(ContractAddress(key), {
          messages: [],
          lastMessageReceived: new Date(0),
          channel: BigInt(message.channel),
          fromName: name,
          address,
          isChannel:
            BigInt(message.channel) !== BigInt(account.address) && BigInt(message.channel) !== BigInt(GLOBAL_CHANNEL),
        });
      }

      const chatMetadata = messageMap.get(ContractAddress(key))!;
      chatMetadata.messages.push({
        address,
        name,
        content,
        channel,
        identity,
        fromSelf,
        timestamp,
      });

      // Update the last message received timestamp
      if (timestamp > chatMetadata.lastMessageReceived) {
        chatMetadata.lastMessageReceived = timestamp;
      }
    });

    // Sort messages within each chat
    messageMap.forEach((metadata, key) => {
      metadata.messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      const tabKey = key.toString().toLowerCase(); // Normalize to lowercase for consistent comparison

      const existingTab = tabs.find((t) => t.address === metadata.address);

      if (existingTab?.name === GLOBAL_CHANNEL_KEY || metadata.address == "0x0") return;

      if (!existingTab) {
        const newTab: Tab = {
          name: metadata.fromName,
          address: metadata.address,
          key: getMessageKey(account.address, BigInt(metadata.address)),
          displayed: true,
          lastSeen: new Date(),
        };
        setTabs([...tabs, newTab]);
      }
    });

    return messageMap;
  }, [allMessageEntities, account.address]);

  const messagesToDisplay = useMemo(() => {
    if (currentTab.name === GLOBAL_CHANNEL_KEY) {
      return messages.get(BigInt(GLOBAL_CHANNEL));
    }
    return messages.get(ContractAddress(getMessageKey(currentTab.address, account.address)));
  }, [messages, currentTab.address]);

  useEffect(() => {
    scrollToElement(bottomChatRef);
  }, [messagesToDisplay]);

  useEffect(() => {
    const selfMessageEntities = runQuery([Has(Message), HasValue(Message, { identity: BigInt(account.address) })]);

    const latestSalt = Array.from(selfMessageEntities).reduce((maxSalt, entity) => {
      const currentSalt = getComponentValue(Message, entity)?.salt ?? 0n;
      return currentSalt > maxSalt ? currentSalt : maxSalt;
    }, 0n);

    setSalt(latestSalt + 1n);
  }, [account.address, messages]);

  const changeTabs = (tab: string | undefined, address: string, fromSelector: boolean = false) => {
    if (address === GLOBAL_CHANNEL_KEY) {
      setCurrentTab(DEFAULT_TAB);
      return;
    }

    if (ContractAddress(address) === ContractAddress(account.address)) {
      return;
    }

    addTab({
      name: fromSelector
        ? shortString.decodeShortString(
            getComponentValue(AddressName, getEntityIdFromKeys([BigInt(address)]))?.name.toString() || "",
          )
        : tab!,
      address,
      displayed: true,
      lastSeen: new Date(),
      key: getMessageKey(account.address, BigInt(address)),
    });
  };

  const renderTabs = useMemo(() => {
    return tabs
      .filter((tab) => ContractAddress(tab.address) !== ContractAddress(account.address))
      .map((tab) => <ChatTab key={tab.address} tab={tab} selected={tab.name === currentTab.name} />);
  }, [tabs, account.address]);

  return (
    <div className={`rounded max-w-[28vw] pointer-events-auto flex flex-col z-1`}>
      <div className="flex flex-row justify-between">
        <div className="flex flex-wrap gap-1 overflow-y-auto max-w-[calc(100%-2rem)] no-scrollbar items-end uppercase font-bold">
          {renderTabs}
        </div>
        <div
          className="flex flex-row items-start h-8 ml-2"
          onClick={() => {
            setHideChat(!hideChat);
          }}
        >
          <div className="bg-hex-bg bg-black/5 h-6 w-6 rounded-t">
            <Minimize className="w-4 h-4 fill-gold self-center mx-auto" />
          </div>
        </div>
      </div>
      <div
        className={`flex flex-col w-[28vw] max-w-[28vw] border bg-black/60 border-gold/40 bg-hex-bg bottom-0 rounded-xl pointer-events-auto flex-grow ${
          hideChat ? "p-0" : "p-1"
        }`}
      >
        <div
          className={`border border-gold/40 text-xs overflow-y-auto transition-all duration-300 rounded-xl flex-grow ${
            hideChat ? "h-0 hidden" : "block h-[20vh] p-2"
          }`}
        >
          {messagesToDisplay?.messages.map((message, index) => (
            <div
              style={{ color: currentTab.name === GLOBAL_CHANNEL_KEY ? PASTEL_PINK : PASTEL_BLUE }}
              className={`flex gap-2 mb-1`}
              key={index}
            >
              <div className="opacity-90 hover:opacity-100">
                <span className=" mr-1 inline" onClick={() => changeTabs(message.name, message.address)}>
                  {message.fromSelf ? "you" : message.name}:
                </span>
                <span
                  className="font-bold mr-2 inline text-wrap max-w-full"
                  style={{ wordBreak: "break-word", overflowWrap: "break-word", whiteSpace: "pre-wrap" }}
                >
                  {`${message.content}`}
                </span>
              </div>
            </div>
          ))}
          <span className="" ref={bottomChatRef}></span>
        </div>
        <div className={`grid gap-2 grid-cols-2 ${hideChat ? "hidden" : "mt-2"}`}>
          <InputField currentTab={currentTab} salt={salt} />
          <Select
            value={
              currentTab.name === GLOBAL_CHANNEL_KEY ? GLOBAL_CHANNEL_KEY : toHexString(BigInt(currentTab.address))
            }
            onValueChange={(address) => {
              changeTabs(undefined, address, true);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select Player or Global" />
            </SelectTrigger>
            <SelectContent>
              {players &&
                players
                  .sort((a, b) => a.addressName.localeCompare(b.addressName))
                  .filter((tab) => ContractAddress(tab.address) !== ContractAddress(account.address))
                  .map((player, index) => (
                    <SelectItem className="flex justify-between" key={index} value={toHexString(player.address)}>
                      {player.addressName}
                    </SelectItem>
                  ))}
              <SelectItem className="flex justify-between" value={GLOBAL_CHANNEL_KEY}>
                Global
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
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
