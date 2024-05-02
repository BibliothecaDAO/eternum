import { useEffect, useRef, useState } from "react";
import { NpcChatMessage } from "./NpcChatMessage";
import { StorageDiscussions, StorageDiscussion, Npc, DiscussionSegment } from "../../types";
import { useResidentsNpcs, scrollToElement } from "../../utils";
import BlurryLoadingImage from "../../../../../../elements/BlurryLoadingImage";
import useRealmStore from "../../../../../../hooks/store/useRealmStore";
import { useDojo } from "../../../../../../DojoContext";
import { defaultNpc } from "../../defaults";
import useNpcStore from "../../../../../../hooks/store/useNpcStore";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { NpcPopup } from "../../NpcPopup";
import { useDiscussion } from "./DiscussionContext";

const NpcChat = ({}) => {
  const [selectedNpc, setSelectedNpc] = useState<Npc | undefined>(undefined);

  const {
    setup: {
      components: { Npc, EntityOwner },
    },
  } = useDojo();

  const { realmEntityId, realmId } = useRealmStore();
  const LOCAL_STORAGE_ID: string = `npc_chat_${realmId}`;

  const { setLastMessageDisplayedIndex, selectedDiscussion, lastMessageDisplayedIndex } = useDiscussion();

  const { isDiscussionLoading } = useNpcStore();

  const residents = useResidentsNpcs(realmEntityId, Npc, EntityOwner);
  const npcs = residents.map(item => item.npc)

  const topRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedDiscussion === null || localStorage.getItem(LOCAL_STORAGE_ID) == null) {
      console.log(selectedDiscussion);
      return;
    }
    setLastMessageDisplayedIndex(0);
    scrollToElement(topRef);
  }, [selectedDiscussion]);

  useEffect(() => {
    if (localStorage.getItem(LOCAL_STORAGE_ID) == null) {
      return;
    }

    if (lastMessageDisplayedIndex !== 0) {
      scrollToElement(bottomRef);
    }

    if (selectedDiscussion === null) {
      return;
    }
    setStoredDiscussionToViewedIfFullyDisplayed(selectedDiscussion, lastMessageDisplayedIndex, LOCAL_STORAGE_ID);
  }, [lastMessageDisplayedIndex]);

  useEffect(() => {}, []);
  return (
    <div className="relative flex flex-col h-full overflow-auto">
      <div
        className="relative flex flex-col h-full overflow-auto top-3 center mx-auto w-[96%] mb-3  border border-gold"
        style={{ scrollbarWidth: "unset" }}
      >
        {(getNumberOfStoredDiscussions(LOCAL_STORAGE_ID) === 0 && !isDiscussionLoading) ? (
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
            {isDiscussionLoading ? (
              <div className="absolute h-full w-[100%] overflow-hidden text-white text-center flex justify-center">
                <div className="self-center">
                  <img src="/images/eternum-logo_animated.png" className="invert scale-50" />
                </div>
              </div>
            ) : (
              getDisplayableChatMessages(
                npcs,
                lastMessageDisplayedIndex,
                selectedDiscussion!,
                bottomRef,
                LOCAL_STORAGE_ID,
                Npc,
                setSelectedNpc,
              )
            )}
            <span className="" ref={bottomRef}></span>;
          </>
        )}
      </div>
      {selectedNpc && <NpcPopup selectedNpc={selectedNpc} onClose={() => setSelectedNpc(undefined)} />}
    </div>
  );
};

const getDiscussionFromStorage = (index: number, localStorageId: string): StorageDiscussion => {
  const discussionsInLocalStorage: StorageDiscussions = JSON.parse(localStorage.getItem(localStorageId) ?? "{}");
  return discussionsInLocalStorage[index];
};

const setStoredDiscussionToViewedIfFullyDisplayed = (
  discussionTs: number,
  lastMessageDisplayedIndex: number,
  localStorageId: string,
) => {
  const discussion: StorageDiscussion = getDiscussionFromStorage(discussionTs, localStorageId);

  if (lastMessageDisplayedIndex != discussion.dialogue.length - 1) return;

  if (discussion.viewed === false) {
    const discussionsInLocalStorage: StorageDiscussions = JSON.parse(localStorage.getItem(localStorageId)!);
    discussionsInLocalStorage[discussionTs].viewed = true;
    localStorage.setItem(localStorageId, JSON.stringify(discussionsInLocalStorage));
  }
};

const getDisplayableChatMessages = (
  npcs: Npc[],
  lastMessageDisplayedIndex: number,
  selectedDiscussion: number,
  bottomRef: React.RefObject<HTMLDivElement>,
  localStorageId: string,
  NpcComponent: any,
  setSelectedNpc: (state: Npc) => void,
) => {
  const storageDiscussion: StorageDiscussion = getDiscussionFromStorage(selectedDiscussion ?? 0, localStorageId);

  if (!storageDiscussion) {
    return;
  }

  const shouldBeUsingTypingEffect = storageDiscussion.viewed == false;

  return storageDiscussion.dialogue.map((message: DiscussionSegment, index: number) => {
    const { npcEntityId, segment } = message;
    if (shouldBeUsingTypingEffect && index > lastMessageDisplayedIndex) {
      return;
    }
    return (
      <NpcChatMessage
        key={index}
        msgIndex={index}
        bottomRef={bottomRef}
        wasAlreadyViewed={storageDiscussion.viewed}
        dialogueSegment={segment}
        npc={getNpcFromRealmNpcsOrEntityId(NpcComponent, BigInt(npcEntityId), npcs)}
        setSelectedNpc={setSelectedNpc}
      />
    );
  });
};

const getNumberOfStoredDiscussions = (localStorageId: string) => {
  const storageDiscussions: StorageDiscussions = JSON.parse(localStorage.getItem(localStorageId) ?? "{}");
  return Object.keys(storageDiscussions).length;
};

const getNpcFromRealmNpcsOrEntityId = (NpcComponent: any, npcEntityId: bigint, npcs: Npc[]): Npc => {
  let maybeNpc = npcs.find((npc: Npc) => npc.entityId === npcEntityId);
  if (maybeNpc !== undefined) {
    return maybeNpc;
  }
  maybeNpc = getComponentValue(NpcComponent, getEntityIdFromKeys([npcEntityId])) as Npc | undefined;
  if (maybeNpc === undefined) {
    return defaultNpc;
  }
  return maybeNpc;
};

export default NpcChat;
