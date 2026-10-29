import { CHAT_PATH } from "@bibliothecadao/notifications";
import { GLOBAL_CHAT_CHANNEL_ID } from "@bibliothecadao/types";
import { useEffect, useLayoutEffect, useRef } from "react";

import { type ChatAlertPress, isChatAlertPress } from "./chat-alert";

/**
 * What a pressed chat alert opens: Global's room, a conversation by its thread (a private message's alert, tagged with
 * it), or a page (a lobby's mention: the lobby, whose room its page opens).
 */
export const chatAlertOpening = (press: ChatAlertPress): { room: string } | { thread: string } | { page: string } => {
  if (press.kind === "direct-message") {
    const thread = press.tag?.startsWith("direct-thread:") ? press.tag.slice("direct-thread:".length) : "";
    return { thread };
  }
  return press.target === CHAT_PATH ? { room: GLOBAL_CHAT_CHANNEL_ID } : { page: press.target };
};

/** Each chat alert pressed while this window stands, as its service worker brings the window forward. */
export const useChatAlertPresses = (onPress: (press: ChatAlertPress) => void) => {
  const latest = useRef(onPress);
  useLayoutEffect(() => {
    latest.current = onPress;
  });
  useEffect(() => {
    const worker = typeof navigator === "undefined" ? undefined : navigator.serviceWorker;
    if (!worker) return;
    const listen = (event: MessageEvent) => {
      if (isChatAlertPress(event.data)) latest.current(event.data);
    };
    worker.addEventListener("message", listen);
    return () => worker.removeEventListener("message", listen);
  }, []);
};
