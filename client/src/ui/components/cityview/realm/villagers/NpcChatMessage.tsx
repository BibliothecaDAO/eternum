import { useState, useEffect, RefObject } from "react";

const INTERKEY_STROKEN_DURATION_MS = 25;
const CHARACTER_NUMBER_PER_LINE = 64;

export interface NpcChatMessageProps {
  npcName: string;
  dialogueSegment: string;
  index: number;
  setLastMessageDisplayedIndex: any;
  selectedTownhall: number;
  viewed: boolean;
  bottomRef: RefObject<HTMLElement>;
}

export function useTypingEffect(
  msgIndex: number,
  setLastMessageDisplayedIndex: any,
  bottomRef: RefObject<HTMLElement>,
  textToType: string,
  selectedTownhall: number,
  interKeyStrokeDurationInMs: number,
) {
  const [displayedText, setDisplayedText] = useState('');

  useEffect(() => {
    setDisplayedText('');

    const intervalId = setInterval(() => {
      setDisplayedText((prev) => {
        if (prev.length < textToType.length) {
          
          if (prev.length % CHARACTER_NUMBER_PER_LINE == 0) {
            setTimeout(() => {
              if (bottomRef.current) {
                bottomRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
              }
            }, 1);
          };
          return textToType.slice(0, prev.length + 1);
        } 
        clearInterval(intervalId);
        setLastMessageDisplayedIndex(msgIndex + 1);
        return prev;
      });
    }, interKeyStrokeDurationInMs);
    return () => clearInterval(intervalId);
  }, [msgIndex, textToType, setLastMessageDisplayedIndex, interKeyStrokeDurationInMs, selectedTownhall]);
  if (textToType === undefined) return "";
  return displayedText;
};


export const NpcChatMessage = (props: NpcChatMessageProps) => {
  const { npcName, dialogueSegment, index, setLastMessageDisplayedIndex, selectedTownhall, bottomRef, viewed } = props;
  
  const typedDialogSegment = viewed
    ? dialogueSegment
    : useTypingEffect(index, setLastMessageDisplayedIndex, bottomRef, dialogueSegment, selectedTownhall, INTERKEY_STROKEN_DURATION_MS);

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
            {typedDialogSegment}
          </div>
        </div>
      </div>
    </div>
  );
};
