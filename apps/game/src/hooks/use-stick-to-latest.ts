import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { useLatest } from "./use-latest";

/** Within this many pixels of its end, a list shows its latest message. */
const AT_LATEST_PX = 40;
/** Within this many pixels of its start, a list asks for older messages. */
const NEAR_OLDEST_PX = 100;

/**
 * A chat's message list: it opens on its latest message, drawn there on its first frame, and stays on the latest as
 * messages arrive or its box resizes. A reader who scrolled up stays where they read: once a message arrives after they
 * left the latest, `hasNewer` holds, for a jump to the latest, until they jump or scroll back down. Older messages put
 * above (a history page) leave the message the reader was on where it was.
 *
 * `oldest` and `newest` are the first and last messages' ids: a room holding its most recent 200 keeps its count when a
 * message arrives, so the ends, not the count, say what changed. `onNearOldest` runs when the reader scrolls near the
 * start, to load older messages.
 */
export const useStickToLatest = ({
  oldest,
  newest,
  onNearOldest,
}: {
  oldest: string | undefined;
  newest: string | undefined;
  onNearOldest?: () => void;
}) => {
  const [scroller, setScroller] = useState<HTMLElement | null>(null);
  // The newest message as the reader scrolled up from the latest; null while they read the latest.
  const [newestWhenLeft, setNewestWhenLeft] = useState<string | undefined | null>(null);
  const atLatest = useRef(true);
  const drawn = useRef({ oldest, newest, height: 0 });
  const currentNewest = useLatest(newest);
  const nearOldest = useLatest(onNearOldest);

  // Before the browser paints, so the list is never seen anywhere else first.
  useLayoutEffect(() => {
    if (!scroller) return;
    const was = drawn.current;
    if (atLatest.current) showLatest(scroller);
    else if (oldest !== was.oldest && newest === was.newest) keepReadingAbove(scroller, was.height);
    drawn.current = { oldest, newest, height: scroller.scrollHeight };
  }, [scroller, oldest, newest]);

  useEffect(() => {
    if (!scroller) return;
    const onScroll = () => {
      const reading = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight >= AT_LATEST_PX;
      atLatest.current = !reading;
      setNewestWhenLeft((left) => (reading ? (left ?? currentNewest.current) : null));
      if (scroller.scrollTop < NEAR_OLDEST_PX) nearOldest.current?.();
    };
    const onResize = () => {
      if (atLatest.current) showLatest(scroller);
    };
    const resizes = new ResizeObserver(onResize);
    resizes.observe(scroller);
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      resizes.disconnect();
      scroller.removeEventListener("scroll", onScroll);
    };
  }, [scroller, currentNewest, nearOldest]);

  const jumpToLatest = useCallback(() => {
    if (!scroller) return;
    atLatest.current = true;
    setNewestWhenLeft(null);
    showLatest(scroller);
  }, [scroller]);

  return { scrollerRef: setScroller, hasNewer: newestWhenLeft !== null && newest !== newestWhenLeft, jumpToLatest };
};

/** Older messages put above, the reader stays on their message: the list scrolls down by what was added. */
const keepReadingAbove = (scroller: HTMLElement, heightBefore: number) => {
  scroller.scrollTop += scroller.scrollHeight - heightBefore;
};

/** At once: a list given smooth scrolling would slide down from its oldest message on every open. */
const showLatest = (scroller: HTMLElement) => {
  scroller.scrollTop = scroller.scrollHeight;
};
