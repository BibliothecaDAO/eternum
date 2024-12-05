import { ReactComponent as Minimize } from "@/assets/icons/common/minimize.svg";
import { useDojo } from "@/hooks/context/DojoContext";
import { useGetOtherPlayers } from "@/hooks/helpers/useGetAllPlayers";
import { useEntityQuery } from "@dojoengine/react";
import { getComponentValue, Has, HasValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { shortString } from "starknet";

import { useGuilds } from "@/hooks/helpers/useGuilds";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/elements/Select";
import TextInput from "@/ui/elements/TextInput";
import { toHexString } from "@/ui/utils/utils";
import { ContractAddress, Player } from "@bibliothecadao/eternum";
import { EventStream } from "../stream/EventStream";
import { useChatStore } from "./ChatState";
import { ChatTab, DEFAULT_TAB } from "./ChatTab";
import { CHAT_COLORS, GLOBAL_CHANNEL, GLOBAL_CHANNEL_KEY } from "./constants";
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

  const [displayMessages, setDisplayMessages] = useState(false);

  const { getGuildFromPlayerAddress } = useGuilds();
  const guildName = getGuildFromPlayerAddress(ContractAddress(account.address))?.name;
  const guildKey = guildName ? shortString.encodeShortString(guildName) : undefined;

  const bottomChatRef = useRef<HTMLDivElement>(null);

  const [hideChat, setHideChat] = useState(false);
  const [salt, setSalt] = useState<bigint>(0n);

  const currentTab = useChatStore((state) => state.currentTab);
  const setCurrentTab = useChatStore((state) => state.setCurrentTab);
  const tabs = useChatStore((state) => state.tabs);

  const addTab = useChatStore((state) => state.addTab);

  const getPlayers = useGetOtherPlayers();

  const players = useMemo(() => {
    return getPlayers();
  }, []);

  useEffect(() => {
    scrollToElement(bottomChatRef);

    if (currentTab.name === "Events") {
      setDisplayMessages(false);
    } else {
      setDisplayMessages(true);
    }
  }, [currentTab]);

  const allMessageEntities = useEntityQuery([Has(Message), HasValue(Message, { identity: BigInt(account.address) })]);

  useEffect(() => {
    const latestSalt = Array.from(allMessageEntities).reduce((maxSalt, entity) => {
      const currentSalt = getComponentValue(Message, entity)?.salt ?? 0n;
      return currentSalt > maxSalt ? currentSalt : maxSalt;
    }, 0n);

    setSalt(latestSalt + 1n);
  }, [account.address, allMessageEntities]);

  const changeTabs = useCallback(
    (tab: string | undefined, address: string, fromSelector: boolean = false) => {
      if (address === GLOBAL_CHANNEL_KEY) {
        setCurrentTab(DEFAULT_TAB);
        return;
      }

      if (guildName && guildKey && address === guildKey) {
        addTab({
          name: guildName,
          address,
          key: guildKey,
          displayed: true,
          lastSeen: new Date(),
        });
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
    },
    [guildName, guildKey, account.address, addTab, setCurrentTab, setDisplayMessages],
  );

  const renderTabs = useMemo(() => {
    return tabs
      .filter(
        (tab) =>
          (tab.name === GLOBAL_CHANNEL_KEY || ContractAddress(tab.address) !== ContractAddress(account.address)) &&
          tab.displayed,
      )
      .map((tab) => <ChatTab key={tab.address} tab={tab} selected={tab.name === currentTab.name} />);
  }, [tabs, account.address, currentTab.name]);

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
          <div className="bg-hex-bg bg-brown/5 h-6 w-6 rounded-t">
            <Minimize className="w-4 h-4 fill-gold self-center mx-auto" />
          </div>
        </div>
      </div>
      <div
        className={`flex flex-col w-[28vw] max-w-[28vw] border bg-brown/90 border-gold/40 bg-hex-bg bottom-0 rounded-xl pointer-events-auto flex-grow ${
          hideChat ? "p-0" : "p-1"
        }`}
      >
        {displayMessages ? (
          <Messages
            account={account}
            currentTab={currentTab}
            guildName={guildName}
            guildKey={guildKey}
            hideChat={hideChat}
            bottomChatRef={bottomChatRef}
            changeTabs={changeTabs}
          />
        ) : (
          <EventStream />
        )}
        <div
          style={{
            color:
              currentTab.name === GLOBAL_CHANNEL_KEY
                ? CHAT_COLORS.GLOBAL
                : currentTab.name === guildName
                  ? CHAT_COLORS.GUILD
                  : CHAT_COLORS.PRIVATE,
          }}
          className={`grid gap-2 grid-cols-2 ${hideChat ? "hidden" : "mt-2"}`}
        >
          <InputField currentTab={currentTab} salt={salt} />
          <ChatSelect
            selectedChannel={currentTab.name}
            changeTabs={changeTabs}
            guildName={guildName}
            players={players}
          />
        </div>
      </div>
    </div>
  );
};

const Messages = ({
  account,
  currentTab,
  guildName,
  guildKey,
  hideChat,
  bottomChatRef,
  changeTabs,
}: {
  account: { address: string };
  currentTab: Tab;
  guildName: string | undefined;
  guildKey: string | undefined;
  hideChat: boolean;
  bottomChatRef: React.RefObject<HTMLDivElement>;
  changeTabs: (tab: string | undefined, address: string) => void;
}) => {
  const {
    setup: {
      components: { Message, AddressName },
    },
  } = useDojo();

  const allMessageEntities = useEntityQuery([Has(Message)]);

  const addTab = useChatStore((state) => state.addTab);

  const messages = useMemo(() => {
    const messageMap = new Map<ContractAddress, ChatMetadata>();

    allMessageEntities.forEach((entity) => {
      const message = getComponentValue(Message, entity);
      if (!message) return;

      const address = toHexString(message.identity);
      const addressName = getComponentValue(AddressName, getEntityIdFromKeys([ContractAddress(address)]));
      if (!addressName) return;

      const fromSelf = message.identity === BigInt(account.address);
      const toSelf = message.channel === BigInt(account.address);
      const isGlobalMessage = BigInt(message.channel) === BigInt(GLOBAL_CHANNEL);
      const isGuildMessage = guildKey && BigInt(message.channel) === BigInt(guildKey);
      const isRelevantMessage = fromSelf || toSelf || isGlobalMessage || isGuildMessage;

      if (!isRelevantMessage) return;

      const senderName = getComponentValue(AddressName, getEntityIdFromKeys([BigInt(address)]));
      const name = shortString.decodeShortString(senderName?.name.toString() || "") || "Unknown";
      const content = message.content || "";
      const timestamp = new Date(Number(message.timestamp));
      const identity = message.identity;
      const channel = message.channel;

      if (!fromSelf && toSelf) {
        // This is a new message to the current user
        addTab({
          name,
          address,
          displayed: true,
          lastSeen: new Date(),
          key: getMessageKey(identity, BigInt(account.address)),
        });
      }

      const key = isGlobalMessage
        ? GLOBAL_CHANNEL
        : isGuildMessage
          ? guildKey
          : getMessageKey(identity, BigInt(message.channel));

      if (!messageMap.has(ContractAddress(key))) {
        messageMap.set(ContractAddress(key), {
          messages: [],
          lastMessageReceived: new Date(0),
          channel: BigInt(message.channel),
          fromName: name,
          address,
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

    return messageMap;
  }, [allMessageEntities, account.address, guildKey]);

  const messagesToDisplay = useMemo(() => {
    if (currentTab.name === GLOBAL_CHANNEL_KEY) {
      return messages.get(BigInt(GLOBAL_CHANNEL));
    }
    if (currentTab.name === guildName && guildKey) {
      return messages.get(ContractAddress(guildKey));
    }
    return messages.get(ContractAddress(getMessageKey(currentTab.address, account.address)));
  }, [messages, currentTab.address, currentTab.name, guildName, guildKey, account.address]);

  return (
    <div
      className={`border border-gold/40 text-xs overflow-y-auto transition-all duration-300 rounded-xl flex-grow ${
        hideChat ? "h-0 hidden" : "block h-[20vh] p-2"
      }`}
    >
      {messagesToDisplay?.messages.map((message, index) => (
        <div
          style={{
            color:
              currentTab.name === GLOBAL_CHANNEL_KEY
                ? CHAT_COLORS.GLOBAL
                : currentTab.name === guildName
                  ? CHAT_COLORS.GUILD
                  : CHAT_COLORS.PRIVATE,
          }}
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
  );
};

const scrollToElement = (ref: React.RefObject<HTMLDivElement>) => {
  setTimeout(() => {
    if (ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, 1);
};

const ChatSelect = ({
  selectedChannel,
  changeTabs,
  guildName,
  players,
}: {
  selectedChannel: string;
  changeTabs: (tab: string | undefined, address: string, fromSelector?: boolean) => void;
  guildName?: string;
  players: Player[];
}) => {
  const [searchInput, setSearchInput] = useState("");
  const [open, setOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  const guildKey = guildName ? shortString.encodeShortString(guildName) : undefined;

  const handleTabChange = (channel: string) => {
    if (channel === GLOBAL_CHANNEL_KEY) {
      changeTabs(undefined, GLOBAL_CHANNEL_KEY);
    } else if (channel === guildKey) {
      changeTabs(undefined, guildKey, true);
    } else {
      const player = players.find((p) => p.addressName === channel);
      if (player) {
        changeTabs(undefined, toHexString(player.address), true);
      }
    }
  };

  const filteredPlayers = players.filter(
    (player) =>
      player.addressName.toLowerCase().startsWith(searchInput.toLowerCase()) || player.addressName === selectedChannel,
  );

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen && inputRef.current) {
      setSearchInput("");
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (filteredPlayers.length > 0) {
        const selectedPlayer = filteredPlayers.find((player) => player.addressName !== selectedChannel);
        if (selectedPlayer) {
          handleTabChange(selectedPlayer.addressName);
          setOpen(false);
        }
      }
      setSearchInput("");
    } else {
      e.stopPropagation();
    }
  };

  return (
    <Select
      open={open}
      onOpenChange={handleOpenChange}
      value={selectedChannel === guildName ? guildKey : selectedChannel}
      onValueChange={(channel) => {
        handleTabChange(channel);
        setOpen(false);
        setSearchInput("");
      }}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select Channel" />
      </SelectTrigger>
      <SelectContent className="bg-brown/90 text-gold">
        <TextInput
          ref={inputRef}
          onChange={setSearchInput}
          placeholder="Filter channels..."
          className="w-full"
          onKeyDown={handleKeyDown}
        />
        <SelectItem value={GLOBAL_CHANNEL_KEY} style={{ color: CHAT_COLORS.GLOBAL }}>
          Global
        </SelectItem>
        {guildName && guildKey && (
          <SelectItem value={guildKey} style={{ color: CHAT_COLORS.GUILD }}>
            {guildName}
          </SelectItem>
        )}
        {filteredPlayers.map((player) => (
          <SelectItem key={player.address} value={player.addressName} style={{ color: CHAT_COLORS.PRIVATE }}>
            {player.addressName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
