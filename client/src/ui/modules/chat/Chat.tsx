import { ReactComponent as Minimize } from "@/assets/icons/common/minimize.svg";
import { useDojo } from "@/hooks/context/DojoContext";
import { useGetOtherPlayers } from "@/hooks/helpers/useGetAllPlayers";
import { useEntityQuery } from "@dojoengine/react";
import { getComponentValue, Has, HasValue, runQuery } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useEffect, useMemo, useRef, useState } from "react";
import { shortString } from "starknet";

import useUIStore from "@/hooks/store/useUIStore";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/elements/Select";
import { toHexString } from "@/ui/utils/utils";
import { ContractAddress } from "@bibliothecadao/eternum";
import { ChatTab, DEFAULT_TAB, getMessageKey, Tab } from "./ChatTab";
import { PASTEL_BLUE, PASTEL_PINK } from "./constants";
import { InputField } from "./InputField";

interface ChatMessage {
  address: string;
  name: string;
  content: string;
  fromSelf: boolean;
  timestamp: Date;
}

export const GLOBAL_CHANNEL = shortString.encodeShortString("global");
const CHAT_STORAGE_KEY = "chat_tabs";
const GLOBAL_CHANNEL_KEY = "global";

export const Chat = () => {
  const {
    masterAccount,
    account: { account },
    setup: {
      components: { Message, AddressName },
    },
  } = useDojo();

  const [hideChat, setHideChat] = useState(false);
  const getPlayers = useGetOtherPlayers();

  const players = useMemo(() => {
    return getPlayers();
  }, [getPlayers]);

  const currentTab = useUIStore((state) => state.currentTab);
  const setCurrentTab = useUIStore((state) => state.setCurrentTab);

  const tabs = useUIStore((state) => state.tabs);
  const setTabs = useUIStore((state) => state.setTabs);

  const storedTabs = useMemo(() => {
    return [...JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY + account.address) || "[]")];
  }, [account.address]);

  useEffect(() => {
    if (account.address === masterAccount.address) return;

    const initialTabs = storedTabs.length === 0 ? [DEFAULT_TAB] : [...storedTabs];
    setNewTabs(initialTabs, account.address, setTabs);
  }, [storedTabs, account.address, masterAccount.address, setTabs]);

  const bottomChatRef = useRef<HTMLDivElement>(null);
  const [salt, setSalt] = useState<bigint>(0n);
  const allMessageEntities = useEntityQuery([Has(Message)]);

  const messages = useMemo(() => {
    const messageMap = new Map<ContractAddress, ChatMessage[]>();

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

      const key =
        BigInt(message.channel) === BigInt(GLOBAL_CHANNEL)
          ? GLOBAL_CHANNEL
          : getMessageKey(message.identity, BigInt(message.channel));

      if (!messageMap.has(ContractAddress(key))) {
        messageMap.set(ContractAddress(key), []);
      }

      messageMap.get(ContractAddress(key))?.push({
        address,
        name,
        content,
        fromSelf,
        timestamp,
      });
    });

    messageMap.forEach((messages) => {
      messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    });

    return messageMap;
  }, [allMessageEntities, account.address]);

  const messagesToDisplay = useMemo(() => {
    if (currentTab.name === "Global") {
      return messages.get(BigInt(GLOBAL_CHANNEL));
    }

    return messages.get(ContractAddress(getMessageKey(currentTab.address, account.address)));
  }, [messages, currentTab.address, tabs]);

  useEffect(() => {
    scrollToElement(bottomChatRef);
  }, [messagesToDisplay]);

  useEffect(() => {
    const selfMessageEntities = runQuery([Has(Message), HasValue(Message, { identity: BigInt(account.address) })]);

    const salts = Array.from(selfMessageEntities)
      .map((entity) => getComponentValue(Message, entity)?.salt ?? 0n)
      .sort((a, b) => Number(b) - Number(a));

    if (salts.length > 0) {
      setSalt(salts[0] + 1n);
    }
  }, [account.address]);

  useEffect(() => {
    messages.forEach((chatMessages, key) => {
      // Skip the Global channel
      if (key.toString() === GLOBAL_CHANNEL_KEY) return;

      // Check if a tab for this sender already exists
      const existingTab = tabs.find((tab) => tab.address === key.toString());

      // If no existing tab, create a new one
      if (!existingTab) {
        const latestMessage = chatMessages[chatMessages.length - 1];
        const newTab: Tab = {
          name: latestMessage.name,
          address: key.toString(), // Ensure the address matches the key in the messages map
          numberOfMessages: chatMessages.filter((msg) => !msg.fromSelf).length,
          displayed: true,
        };

        addNewTab(tabs, newTab, setCurrentTab, account.address, setTabs);
      }
    });
  }, [messages, tabs, setCurrentTab, account.address, setTabs]);

  const changeTabs = (tab: string | undefined, address: string, fromSelector: boolean = false) => {
    if (address === "Global") {
      setCurrentTab(DEFAULT_TAB);
      return;
    }

    if (ContractAddress(address) === ContractAddress(account.address)) {
      return;
    }

    const tabName = fromSelector
      ? shortString.decodeShortString(
          getComponentValue(AddressName, getEntityIdFromKeys([BigInt(address)]))?.name.toString() || "",
        )
      : tab!;

    const numberOfMessages = messages.get(ContractAddress(address))?.filter((message) => !message.fromSelf).length || 0;

    const currentTab: Tab = {
      name: tabName,
      address,
      numberOfMessages,
      displayed: true,
    };

    setCurrentTab(currentTab);

    const newTabs = [...tabs];
    const existingTabIndex = newTabs.findIndex((tab) => ContractAddress(tab.address) === ContractAddress(address));

    if (existingTabIndex === -1) {
      newTabs.push(currentTab);
    } else if (!newTabs[existingTabIndex].displayed) {
      newTabs[existingTabIndex].displayed = true;
    }

    setNewTabs(newTabs, account.address, setTabs);
  };

  const removeTab = (address: string) => {
    const newTabs = tabs.map((tab) => (tab.address === address ? { ...tab, displayed: false } : tab));

    setCurrentTab(DEFAULT_TAB);
    setNewTabs(newTabs, account.address, setTabs);
  };

  return (
    <div className={`rounded max-w-[28vw] pointer-events-auto flex flex-col`} style={{ zIndex: 1 }}>
      <div className="flex flex-row justify-between">
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
        <div
          className="flex flex-row items-end h-8"
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
        className={`flex flex-col w-[28vw] max-w-[28vw] border bg-black/40 border-gold/40 bg-hex-bg bottom-0 rounded-b pointer-events-auto flex-grow ${
          hideChat ? "p-0" : "p-1"
        }`}
      >
        <div
          className={`border border-gold/40 rounded text-xs overflow-y-auto transition-all duration-300 flex-grow ${
            hideChat ? "h-0 hidden" : "block h-[20vh] p-2"
          }`}
        >
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
          <InputField currentTab={currentTab} setCurrentTab={setCurrentTab} salt={salt} />
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
                  <SelectItem className="flex justify-between" key={index} value={toHexString(player.address)}>
                    {player.addressName}
                  </SelectItem>
                ))}
              <SelectItem className="flex justify-between" value="Global">
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

const setNewTabs = (newTabs: Tab[], address: string, setTabs: (tabs: Tab[]) => void) => {
  setTabs(newTabs);
  localStorage.setItem(CHAT_STORAGE_KEY + address, JSON.stringify(newTabs));
};

export const addNewTab = (
  oldTabs: Tab[],
  newTab: Tab,
  setCurrentTab: (tab: Tab) => void,
  address: string,
  setTabs: (tabs: Tab[]) => void,
) => {
  let allTabs = [...oldTabs];

  if (allTabs.find((tab) => tab.address === newTab.address)) {
    allTabs.map((tab) => {
      if (tab.address === newTab.address) {
        tab.displayed = true;
      }
      return tab;
    });
  } else {
    allTabs.push(newTab);
  }

  setNewTabs(allTabs, address, setTabs);
  setCurrentTab(newTab);
};
