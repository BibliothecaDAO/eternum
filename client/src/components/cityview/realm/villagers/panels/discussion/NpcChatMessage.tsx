import { useState, useEffect, RefObject } from "react";
import { ReactComponent as Info } from "../../../../../../assets/icons/npc/info.svg";
import { Npc } from "../../types";
import { useDiscussion } from "./DiscussionContext";

const INTERKEY_STROKEN_DURATION_MS = 35;

export interface NpcChatMessageProps {
  npc: Npc;
  dialogueSegment: string;
  msgIndex: number;
  wasAlreadyViewed: boolean;
  bottomRef: RefObject<HTMLDivElement>;
  setSelectedNpc: (state: Npc) => void;
}

export function useTypingEffect(
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
  const { msgIndex, setSelectedNpc, npc, dialogueSegment, wasAlreadyViewed } = props;
  const { setLastMessageDisplayedIndex } = useDiscussion();
  const [typingCompleted, setTypingComplete] = useState(false);

  const showNpcPopup = () => {
    setSelectedNpc(npc);
  };

  const displayedDialogSegment = useTypingEffect(dialogueSegment, setTypingComplete, wasAlreadyViewed);

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
            <div onClick={showNpcPopup} style={{ userSelect: "text" }} className="flex relative text-gold text-[10px]">
              {npc.fullName}
              <Info className="ml-1.5 rounded-sm  p-0.5 bg-gold" />
            </div>
          </div>
          <div style={{ userSelect: "text" }} className="mt-1 text-xs text-white/70">
            {displayedDialogSegment}
          </div>
        </div>
      </div>
    </div>
  );
};
