import { useEffect, useRef } from "react";
import { NpcChatMessage } from "./NpcChatMessage";
import { StorageTownhalls, StorageTownhall, Npc, NpcTownhallMessage } from "../../types";
import { useResidentsNpcs, scrollToElement } from "../../utils";
import BlurryLoadingImage from "../../../../../../elements/BlurryLoadingImage";
import useRealmStore from "../../../../../../hooks/store/useRealmStore";
import { useDojo } from "../../../../../../DojoContext";
import { defaultNpc } from "../../defaults";
import useNpcStore from "../../../../../../hooks/store/useNpcStore";

const NpcChat = ({}) => {
  const {
    setup: {
      components: { Npc, EntityOwner },
    },
  } = useDojo();

  const { realmEntityId, realmId } = useRealmStore();
  const LOCAL_STORAGE_ID: string = `npc_chat_${realmId}`;

  const { setLastMessageDisplayedIndex, selectedTownhall, lastMessageDisplayedIndex, isTownHallLoading } =
    useNpcStore();

  const residents = useResidentsNpcs(realmEntityId, Npc, EntityOwner);
  const npcs = residents.foreigners.concat(residents.natives);

  const topRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedTownhall === null || localStorage.getItem(LOCAL_STORAGE_ID) == null) {
      console.log(selectedTownhall);
      return;
    }
    setLastMessageDisplayedIndex(0);
    scrollToElement(topRef);
  }, [selectedTownhall]);

  useEffect(() => {
    if (localStorage.getItem(LOCAL_STORAGE_ID) == null) {
      return;
    }

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
            {isTownHallLoading ? (
              <div className="absolute h-full w-[100%] overflow-hidden text-white text-center flex justify-center">
                <div className="self-center">
                  <img src="/images/eternum-logo_animated.png" className="invert scale-50" />
                </div>
              </div>
            ) : (
              getDisplayableChatMessages(
                npcs,
                lastMessageDisplayedIndex,
                selectedTownhall!,
                bottomRef,
                LOCAL_STORAGE_ID,
              )
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
  npcs: Npc[],
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

  return storageTownhall.dialogue.map((message: NpcTownhallMessage, index: number) => {
    const { fullName, dialogueSegment } = message;
    if (shouldBeUsingTypingEffect && index > lastMessageDisplayedIndex) {
      return;
    }
    return (
      <NpcChatMessage
        key={index}
        msgIndex={index}
        bottomRef={bottomRef}
        wasAlreadyViewed={storageTownhall.viewed}
        dialogueSegment={dialogueSegment}
        npc={getNpcByName(fullName, npcs)}
      />
    );
  });
};

const getNumberOfStoredTownhalls = (localStorageId: string) => {
  const storageTownhalls: StorageTownhalls = JSON.parse(localStorage.getItem(localStorageId) ?? "{}");
  return Object.keys(storageTownhalls).length;
};

const getNpcByName = (name: string, npcs: Npc[]): Npc => {
  return npcs.find((npc: Npc) => npc.fullName === name) || defaultNpc;
};

export default NpcChat;
