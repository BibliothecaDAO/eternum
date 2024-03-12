import { useEffect, useRef } from "react";
import { NpcChatMessage } from "./NpcChatMessage";
import { StorageTownhalls, StorageTownhall, NpcChatProps } from "./types";
import { scrollToElement } from "./utils";
import { useNpcContext } from "./NpcContext";
import BlurryLoadingImage from "../../../../elements/BlurryLoadingImage";

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
        {getNumberOfStoredTownhalls(LOCAL_STORAGE_ID) === 0 ? (
          <>
            <BlurryLoadingImage
              blurhash="LBHLO~W9x.F^Atoy%2Ri~TA0Myxt"
              height="200px"
              width="100%"
              src="/images/townhall.png"
            />
            <div className="flex flex-col p-2 absolute left-2 bottom-2 right-2 rounded-[10px] bg-black/90">
              <div className="mb-1 ml-1 italic text-center text-light-pink text-xxs">
                Ring the townhall bell to gather your villagers and hear their thoughts about important events
              </div>
            </div>
          </>
        ) : (
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
        )}
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

  if (lastMessageDisplayedIndex != townhall.dialogue.length - 1) return;

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

  return storageTownhall.dialogue.map((message: any, index: number) => {
    if (shouldBeUsingTypingEffect && index > lastMessageDisplayedIndex) {
      return;
    }
    return (
      <NpcChatMessage
        key={index}
        msgIndex={index}
        bottomRef={bottomRef}
        wasAlreadyViewed={storageTownhall.viewed}
        {...message}
      />
    );
  });
};

const getNumberOfStoredTownhalls = (localStorageId: string) => {
  const storageTownhalls: StorageTownhalls = JSON.parse(localStorage.getItem(localStorageId) ?? "{}");
  return Object.keys(storageTownhalls).length;
};

export default NpcChat;
