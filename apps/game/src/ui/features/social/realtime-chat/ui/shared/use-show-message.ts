import { type RefObject, useCallback, useEffect, useRef, useState } from "react";

/** How long a message shown from a reply's quote stays lit. */
const LIT_MS = 1_500;

/**
 * A reply's quote pressed: the message it answers, where the list still holds it, scrolls to the middle of the list
 * and stays lit a moment. One older than what the list has read stays where it is; the quote already says it.
 */
export const useShowMessage = (list: RefObject<HTMLElement>) => {
  const [lit, setLit] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    return () => clearTimeout(timer.current);
  }, []);
  const show = useCallback(
    (id: string) => {
      const message = [...(list.current?.querySelectorAll("[data-message-id]") ?? [])].find(
        (row) => row.getAttribute("data-message-id") === id,
      );
      if (!message) return;
      message.scrollIntoView({ block: "center" });
      setLit(id);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setLit(null), LIT_MS);
    },
    [list],
  );
  return { lit, show };
};
