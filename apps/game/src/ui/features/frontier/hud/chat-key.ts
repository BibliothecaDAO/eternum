import { CHAT_SHORTCUT } from "@/ui/features/world/containers/chat-shortcut";
import { isKeyForSurface } from "@/utils/shortcuts/typing-target";
import { useChatRevealed } from "@/ui/features/social/realtime-chat/hooks/use-chat-revealed";
import { type RefObject, useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * The chat key (Enter, as Settings lists it) puts the cursor in chat: it opens chat where it is closed, then focuses
 * the field of the pane the returned ref is given to. Never while typing, and never an Enter a preview's verb took. A
 * pressed chat alert opens chat too (useChatRevealed).
 */
export const useChatKey = (openChat: () => void): RefObject<HTMLElement> => {
  const pane = useRef<HTMLElement>(null);
  const [presses, setPresses] = useState(0);
  const open = useRef(openChat);
  useLayoutEffect(() => {
    open.current = openChat;
  });
  useChatRevealed(() => open.current());
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== CHAT_SHORTCUT.key || event.repeat || event.defaultPrevented) return;
      if (isKeyForSurface(event)) return;
      event.preventDefault();
      open.current();
      setPresses((count) => count + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    if (presses > 0) pane.current?.querySelector<HTMLElement>("input,textarea")?.focus();
  }, [presses]);
  return pane;
};
