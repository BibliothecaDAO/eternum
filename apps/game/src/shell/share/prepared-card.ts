import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { CARD_STILL } from "@/utils/card-image";

/**
 * A card's image made before the press that sends it, as a phone opens its share sheet only within the press itself,
 * and only ever the image of the card as it is drawn now. The image belongs to one drawing of the card: its node, and
 * everything in it (the game it names, the viewer's place, every player's name and number). Any change to the card
 * drops the image at once and makes it again, and an image the card changed under while it was being made is thrown
 * away, so whatever the card shows, its image shows. `ready` holds the making until the card shows all it will.
 * `image` is for drawing the button; `take` is for the press, which also catches a change not yet heard.
 */
export const usePreparedCard = <Image>(
  card: HTMLElement | null,
  ready: boolean,
  make: (card: HTMLElement) => Promise<Image>,
) => {
  const { drawing, changedSince, drawn } = useDrawing(card);
  const makeImage = useRef(make);
  useLayoutEffect(() => {
    makeImage.current = make;
  });
  const [made, setMade] = useState<{ drawing: Drawing; image?: Image } | null>(null);
  useEffect(() => {
    const node = drawing.card;
    if (!ready || !node) return;
    let current = true;
    drawn();
    makeImage.current(node).then(
      (image) => current && setMade({ drawing, image }),
      () => current && setMade({ drawing }),
    );
    return () => {
      current = false;
    };
  }, [drawing, ready, drawn]);
  const now = ready && made?.drawing === drawing ? made : null;
  return {
    image: now?.image,
    failed: now !== null && now.image === undefined,
    take: () => (changedSince() ? undefined : now?.image),
  };
};

/** One drawing of the card: a new one whenever the card is another node or anything in it changes. */
type Drawing = { card: HTMLElement | null };

/**
 * The card's current drawing, watched for every change to it and what is in it, whoever renders it. `changedSince`
 * takes the changes the watch has seen but not yet told, and starts a new drawing if there are any. `drawn` lets go of
 * them as an image begins: the image is made from the card as it stands, so they are in it (the render that made the
 * card ready changed it too).
 */
const useDrawing = (card: HTMLElement | null) => {
  const [drawing, setDrawing] = useState<Drawing>({ card });
  if (drawing.card !== card) setDrawing({ card });
  const watch = useRef<MutationObserver | null>(null);
  useEffect(() => {
    if (!card) return;
    const observer = new MutationObserver((changes) => changes.some(redraws) && setDrawing({ card }));
    observer.observe(card, { subtree: true, childList: true, characterData: true, attributes: true });
    watch.current = observer;
    return () => observer.disconnect();
  }, [card]);
  const drawn = useCallback(() => void watch.current?.takeRecords(), []);
  const changedSince = () => {
    const changed = watch.current?.takeRecords().some(redraws) ?? false;
    if (changed) setDrawing({ card });
    return changed;
  };
  return { drawing, changedSince, drawn };
};

/** A change to what the card shows; not the hold on its motion while its image is made. */
const redraws = (change: MutationRecord) => change.attributeName !== CARD_STILL;
