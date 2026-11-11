import { useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * A card's image made before the press that sends it, as a phone opens its share sheet only within the press itself,
 * and only ever the image of the card as it is drawn now. The image belongs to one snapshot: the card's node and
 * `drawnFrom`, the values the card is drawn from (its game or day, the viewer, the layout, the names reader), each
 * compared as React compares dependencies. A changed value is a new snapshot: the old image is dropped in that render
 * and made again, and an image whose snapshot passed while it was being made is thrown away. `ready` holds the making
 * until every value the card draws has answered. `snapshot` names what the image shows, for a consumer that must tell
 * one card's image from another's (a published preview).
 */
export const usePreparedCard = <Image>(
  card: HTMLElement | null,
  drawnFrom: readonly unknown[],
  ready: boolean,
  make: (card: HTMLElement) => Promise<Image>,
) => {
  const snapshot = useSnapshot(card, drawnFrom);
  const makeImage = useRef(make);
  useLayoutEffect(() => {
    makeImage.current = make;
  });
  const [made, setMade] = useState<{ snapshot: Snapshot; image?: Image } | null>(null);
  useEffect(() => {
    const node = snapshot.card;
    // A node already taken off the page (the render that swaps a card for a new one) is no card the player sees.
    if (!ready || !node?.isConnected) return;
    let current = true;
    makeImage.current(node).then(
      (image) => current && setMade({ snapshot, image }),
      () => current && setMade({ snapshot }),
    );
    return () => {
      current = false;
    };
  }, [snapshot, ready]);
  const now = ready && made?.snapshot === snapshot ? made : null;
  return { snapshot, image: now?.image, failed: now !== null && now.image === undefined };
};

/** One drawing of the card: its node and the values it is drawn from. */
type Snapshot = { card: HTMLElement | null; drawnFrom: readonly unknown[] };

/** The card's snapshot: the same object while its node and every value are the same, a new one when any changes. */
const useSnapshot = (card: HTMLElement | null, drawnFrom: readonly unknown[]): Snapshot => {
  const last = useRef<Snapshot | null>(null);
  if (!last.current || !isSameDrawing(last.current, card, drawnFrom)) last.current = { card, drawnFrom };
  return last.current;
};

const isSameDrawing = (snapshot: Snapshot, card: HTMLElement | null, drawnFrom: readonly unknown[]) =>
  snapshot.card === card &&
  snapshot.drawnFrom.length === drawnFrom.length &&
  snapshot.drawnFrom.every((value, index) => Object.is(value, drawnFrom[index]));
