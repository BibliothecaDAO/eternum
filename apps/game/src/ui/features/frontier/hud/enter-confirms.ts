import { isKeyForSurface } from "@/utils/shortcuts/typing-target";
import { useEffect, useLayoutEffect, useRef } from "react";

/**
 * On a keyboard, Enter confirms the open preview's verb; never while the player is typing, and never without a verb to
 * run. It takes the key before chat's Enter does, so one press is one thing.
 */
export const useEnterConfirms = (onGo: (() => void) | undefined) => {
  const latest = useRef(onGo);
  useLayoutEffect(() => {
    latest.current = onGo;
  });
  useEffect(() => {
    const confirm = (event: KeyboardEvent) => {
      if (event.key !== "Enter" || event.repeat || isKeyForSurface(event) || !latest.current) return;
      event.preventDefault();
      latest.current();
    };
    window.addEventListener("keydown", confirm, true);
    return () => window.removeEventListener("keydown", confirm, true);
  }, []);
};
