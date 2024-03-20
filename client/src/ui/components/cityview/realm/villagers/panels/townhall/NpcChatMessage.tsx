import { useState, useEffect, RefObject } from "react";
import { useNpcContext } from "../../NpcContext";
import { scrollToElement } from "../../utils";
import Avatar from "../../../../../../elements/Avatar";
import { NpcPopup } from "../../NpcPopup";
import { Npc } from "../../types";

const INTERKEY_STROKEN_DURATION_MS = 35;
const CHARACTER_NUMBER_PER_LINE = 64;

export interface NpcChatMessageProps {
  npc: Npc;
  dialogueSegment: string;
  msgIndex: number;
  wasAlreadyViewed: boolean;
  bottomRef: RefObject<HTMLDivElement>;
}

export function useTypingEffect(
  bottomRef: RefObject<HTMLDivElement>,
  textToType: string,
  setTypingCompleted: (state: boolean) => void,
  wasAlreadyViewed: boolean,
) {
  const [displayedText, setDisplayedText] = useState("");

  useEffect(() => {
    if (wasAlreadyViewed) {
      setDisplayedText(textToType);
      return;
    }

    setDisplayedText("");

    const intervalId = setInterval(() => {
      setDisplayedText((prev) => {
        if (prev.length < textToType.length) {
          if (prev.length % CHARACTER_NUMBER_PER_LINE == 0) {
            scrollToElement(bottomRef!);
          }
          return textToType.slice(0, prev.length + 1);
        }
        clearInterval(intervalId);
        setTypingCompleted(true);
        return prev;
      });
    }, INTERKEY_STROKEN_DURATION_MS);
    return () => clearInterval(intervalId);
  }, [textToType]);

  return displayedText;
}

export const NpcChatMessage = (props: NpcChatMessageProps) => {
  const { msgIndex, npc, dialogueSegment, bottomRef, wasAlreadyViewed } = props;
  const { setLastMessageDisplayedIndex } = useNpcContext();
  const [typingCompleted, setTypingComplete] = useState(false);
  const [showNpcStats, setShowNpcStats] = useState(false);

  const displayedDialogSegment = useTypingEffect(bottomRef, dialogueSegment, setTypingComplete, wasAlreadyViewed);

  useEffect(() => {
    if (typingCompleted) {
      setLastMessageDisplayedIndex(msgIndex + 1);
      setTypingComplete(false);
    }
  }, [typingCompleted]);

  return (
    <div className="flex flex-col px-2 mb-3 py-1">
      <div className="flex items-center">
        <div className="flex flex-col w-full">
          <div className="flex flex-row items-end h-5">
            <div onClick={() => setShowNpcStats(true)}>
              <Avatar src="/images/npc/default-npc.svg" className="p-1 w-4 h-4 mr-1" />
            </div>
            <div
              onClick={() => setShowNpcStats(true)}
              style={{ userSelect: "text" }}
              className="relative text-white/50 text-[10px]"
            >
              {npc.fullName}
            </div>
          </div>
          <div style={{ userSelect: "text" }} className="mt-1 text-xs text-white/70">
            {displayedDialogSegment}
          </div>
        </div>
      </div>
      {showNpcStats && <NpcPopup onClose={() => setShowNpcStats(false)} npc={npc} />}
    </div>
  );
};
