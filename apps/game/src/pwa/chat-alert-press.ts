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

/**
 * A chat alert pressed in the iOS app (ios-app-push.ts), held until a chat takes it: on a cold start the alert is
 * pressed before any chat is drawn.
 */
let appPress: ChatAlertPress | null = null;
const APP_PRESS = "realms:app-chat-alert-press";

/** Hands an alert pressed in the iOS app to the chat drawn now, or to the next one drawn. */
export const pressAppChatAlert = (press: ChatAlertPress) => {
  appPress = press;
  window.dispatchEvent(new Event(APP_PRESS));
};

/**
 * Each chat alert pressed while this window stands: as its service worker brings the window forward, or as the iOS app
 * opens it from its alert.
 */
export const useChatAlertPresses = (onPress: (press: ChatAlertPress) => void) => {
  const latest = useRef(onPress);
  useLayoutEffect(() => {
    latest.current = onPress;
  });
  useEffect(() => {
    const takeAppPress = () => {
      const press = appPress;
      appPress = null;
      if (press) latest.current(press);
    };
    takeAppPress();
    window.addEventListener(APP_PRESS, takeAppPress);
    const worker = typeof navigator === "undefined" ? undefined : navigator.serviceWorker;
    const listen = (event: MessageEvent) => {
      if (isChatAlertPress(event.data)) latest.current(event.data);
    };
    worker?.addEventListener("message", listen);
    return () => {
      window.removeEventListener(APP_PRESS, takeAppPress);
      worker?.removeEventListener("message", listen);
    };
  }, []);
};
