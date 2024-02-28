import { useState, useEffect, RefObject } from "react";
import { useNpcContext } from "./NpcContext";

const INTERKEY_STROKEN_DURATION_MS = 35;
const CHARACTER_NUMBER_PER_LINE = 64;

export interface NpcChatMessageProps {
  npcName: string;
  dialogueSegment: string;
  msgIndex: number;
  viewed: boolean;
  bottomRef: RefObject<HTMLElement>;
}

export function useTypingEffect(
  msgIndex: number,
  bottomRef: RefObject<HTMLElement>,
  textToType: string,
  interKeyStrokeDurationInMs: number,
  setTypingCompleted: (state: boolean) => void,
  wasAlreadyViewed: boolean,
) {
  const [displayedText, setDisplayedText] = useState("");
  const { selectedTownhall, setLastMessageDisplayedIndex } = useNpcContext();

  if (textToType === undefined) {
    return;
  }

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
            setTimeout(() => {
              if (bottomRef.current) {
                bottomRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
              }
            }, 1);
          }
          return textToType.slice(0, prev.length + 1);
        }
        clearInterval(intervalId);
        setTypingCompleted(true);
        return prev;
      });
    }, interKeyStrokeDurationInMs);
    return () => clearInterval(intervalId);
  }, [msgIndex, textToType, setLastMessageDisplayedIndex, interKeyStrokeDurationInMs, selectedTownhall]);

  if (textToType === undefined) return "";

  return displayedText;
}

export const NpcChatMessage = (props: NpcChatMessageProps) => {
  const { msgIndex, npcName, dialogueSegment, bottomRef, viewed: wasAlreadyViewed } = props;
  const { setLastMessageDisplayedIndex } = useNpcContext();
  const [typingCompleted, setTypingComplete] = useState(false);

  const displayedDialogSegment = useTypingEffect(
    msgIndex,
    bottomRef,
    dialogueSegment,
    INTERKEY_STROKEN_DURATION_MS,
    setTypingComplete,
    wasAlreadyViewed,
  );

  useEffect(() => {
    if (typingCompleted) {
      setLastMessageDisplayedIndex(msgIndex + 1);
      setTypingComplete(false);
    }
  }, [typingCompleted, msgIndex, setLastMessageDisplayedIndex]);

  return (
    <div className="flex flex-col px-2 mb-3 py-1">
      <div className="flex items-center">
        <div className="flex flex-col w-full">
          <div className="flex text-[10px] justify-between">
            <div className="flex">
              <div style={{ userSelect: "text" }} className="text-white/50">
                {npcName}
              </div>
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
