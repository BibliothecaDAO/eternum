import { useEffect, useLayoutEffect, useRef } from "react";

import { useRealtimeChatSelector } from "./use-realtime-chat";

/**
 * A chat surface's answer to a pressed alert (openAlert): `reveal` runs each time chat is asked to open, never for a
 * request made before the surface stood, nor when a new connection starts the count again.
 */
export const useChatRevealed = (reveal: () => void) => {
  const revealed = useRealtimeChatSelector((state) => state.chatRevealed);
  const answered = useRef(revealed);
  const latest = useRef(reveal);
  useLayoutEffect(() => {
    latest.current = reveal;
  });
  useEffect(() => {
    const asked = revealed > answered.current;
    answered.current = revealed;
    if (asked) latest.current();
  }, [revealed]);
};
