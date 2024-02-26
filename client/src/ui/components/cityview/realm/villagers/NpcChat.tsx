import { useEffect, useRef, useMemo } from "react";
import { NpcChatMessage } from "./NpcChatMessage";
import { StorageTownhalls, StorageTownhall, TownhallResponse, NpcChatProps } from "./types";
import useRealmStore from "../../../../hooks/store/useRealmStore";
import { getRealm } from "../../../../utils/realms";
import { scrollToElement } from "./utils";
import { useNpcContext } from "./NpcContext";

const NpcChat = ({ LastWsMessage }: NpcChatProps) => {
  const {
    selectedTownhall,
    setSelectedTownhall,
    lastMessageDisplayedIndex,
    setLastMessageDisplayedIndex,
    loadingTownhall,
    setLoadingTownhall,
  } = useNpcContext();

  const { realmId } = useRealmStore();
  const LOCAL_STORAGE_ID: string = `npc_chat_${realmId}`;

  const realm = useMemo(() => {
    return realmId ? getRealm(realmId) : undefined;
  }, [realmId]);

  const topRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedTownhall === null) {
      return;
    }
    setLastMessageDisplayedIndex(0);
    scrollToElement(topRef);
  }, [selectedTownhall]);

  useEffect(() => {
    if (lastMessageDisplayedIndex !== 0) {
      scrollToElement(bottomRef);
    }

    if (selectedTownhall === null) {
      return;
    }

    setStoredTownhallToViewedIfFullyDisplayed(selectedTownhall, lastMessageDisplayedIndex, LOCAL_STORAGE_ID);
  }, [lastMessageDisplayedIndex]);

  useEffect(() => {
    if (LastWsMessage === null) {
      return;
    }

    setLastMessageDisplayedIndex(0);
    const townhallKey = addTownHallToStorage(LastWsMessage as TownhallResponse, LOCAL_STORAGE_ID);
    setSelectedTownhall(townhallKey);
    setLoadingTownhall(false);
  }, [LastWsMessage]);

  useEffect(() => {}, []);
  return (
    <div className="relative flex flex-col h-full overflow-auto">
      <div
        className="relative flex flex-col h-full overflow-auto top-3 center mx-auto w-[96%] mb-3  border border-gold"
        style={{ scrollbarWidth: "unset" }}
      >
        <>
          <span className="" ref={topRef}></span>
          {loadingTownhall ? (
            <div className="absolute h-full w-[100%] overflow-hidden text-white text-center flex justify-center">
              <div className="self-center">
                <img src="/images/eternum-logo_animated.png" className="invert scale-50" />
              </div>
            </div>
          ) : (
            getDisplayableChatMessages(lastMessageDisplayedIndex, selectedTownhall!, bottomRef, LOCAL_STORAGE_ID)
          )}
          <span className="" ref={bottomRef}></span>;
        </>
      </div>
    </div>
  );
};

const getTownhallFromStorage = (index: number, localStorageId: string): StorageTownhall => {
  const townhallsInLocalStorage: StorageTownhalls = JSON.parse(localStorage.getItem(localStorageId) ?? "{}");

  return townhallsInLocalStorage[index];
};

const addTownHallToStorage = (message: TownhallResponse, localStorageId: string): number => {
  const townhallKey = message["id"];
  const townhallDiscussion: string[] = message["townhall"].split(/\n+/);

  if (townhallDiscussion[townhallDiscussion.length - 1] === "") {
    townhallDiscussion.pop();
  }

  const discussionsByNpc = townhallDiscussion.map((msg) => {
    const splitMessage = msg.split(":");
    return { npcName: splitMessage[0], dialogueSegment: splitMessage[1] };
  });

  const newEntry: StorageTownhall = { viewed: false, discussion: discussionsByNpc };

  const townhallsInLocalStorage = localStorage.getItem(localStorageId);
  const storedTownhalls: StorageTownhalls = JSON.parse(townhallsInLocalStorage ?? "{}");
  storedTownhalls[townhallKey] = newEntry;
  localStorage.setItem(localStorageId, JSON.stringify(storedTownhalls));

  return townhallKey;
};

const setStoredTownhallToViewedIfFullyDisplayed = (
  townhallIndex: number,
  lastMessageDisplayedIndex: number,
  localStorageId: string,
) => {
  const townhall: StorageTownhall = getTownhallFromStorage(townhallIndex, localStorageId);

  // Until we haven't displayed the last message, don't set the local storage to true. Otherwise the scroll stops after we displayed the first message
  if (lastMessageDisplayedIndex != townhall.discussion.length - 1) return;

  if (townhall.viewed === false) {
    const townhallsInLocalStorage: StorageTownhalls = JSON.parse(localStorage.getItem(localStorageId)!);
    townhallsInLocalStorage[townhallIndex].viewed = true;
    localStorage.setItem(localStorageId, JSON.stringify(townhallsInLocalStorage));
  }
};

const getDisplayableChatMessages = (
  lastMessageDisplayedIndex: number,
  selectedTownhall: number,
  bottomRef: React.RefObject<HTMLDivElement>,
  localStorageId: string,
) => {
  const storageTownhall: StorageTownhall = getTownhallFromStorage(selectedTownhall ?? 0, localStorageId);

  if (!storageTownhall) {
    return;
  }

  const shouldBeUsingTypingEffect = storageTownhall.viewed == false;

  return storageTownhall.discussion.map((message: any, index: number) => {
    if (shouldBeUsingTypingEffect && index > lastMessageDisplayedIndex) {
      return;
    }
    return (
      <NpcChatMessage key={index} msgIndex={index} bottomRef={bottomRef} viewed={storageTownhall.viewed} {...message} />
    );
  });
};

export default NpcChat;
