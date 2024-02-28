import { useEffect, useRef } from "react";
import { NpcChatMessage } from "./NpcChatMessage";
import { StorageTownhalls, StorageTownhall, NpcChatProps } from "./types";
import { scrollToElement } from "./utils";
import { useNpcContext } from "./NpcContext";

const NpcChat = ({}: NpcChatProps) => {
  const {
    setLastMessageDisplayedIndex,
    selectedTownhall,
    lastMessageDisplayedIndex,
    loadingTownhall,
    LOCAL_STORAGE_ID,
  } = useNpcContext();

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
