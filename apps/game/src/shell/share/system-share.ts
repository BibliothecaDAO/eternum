import { useEffect, useState, type RefObject } from "react";

import { SHARE_WORDS } from "@/ui/design-system/kit/words";
import { cardFile, type CardSize } from "@/utils/card-image";

/**
 * Share through the device's own share sheet (a phone's, and the iOS app's, whose web view opens iOS's own): the card's
 * image, the post's line and its link, to whichever app the player picks there. The image is made before the press, as
 * soon as the card is `ready`, because a phone opens its sheet only within the press itself; `making` says so until
 * then. `onPress` hears the press; `onShared` only a share the sheet carried out, never one the player closed. Each
 * surface draws the button in its own kit's (a Frontier day's in the HUD's, the season's recap in the app's).
 */
export const useSystemShare = ({
  card,
  size,
  fileName,
  line,
  url,
  ready,
  onPress,
  onShared,
}: {
  card: RefObject<HTMLElement>;
  size: CardSize;
  fileName: string;
  line: string;
  url: string;
  /** Whether the card says all it will (its players' names read): the image is made only then. */
  ready: boolean;
  onPress?: () => void;
  onShared?: () => void;
}) => {
  const file = useCardFile(card, size, fileName, ready);
  const [failed, setFailed] = useState(false);
  const share = async (image: File) => {
    setFailed(false);
    onPress?.();
    try {
      await navigator.share({ files: [image], text: line, url });
      onShared?.();
    } catch (error) {
      // Closing the sheet is the player's choice, not a failure.
      if ((error as { name?: string }).name !== "AbortError") setFailed(true);
    }
  };
  return {
    share: () => file.image && void share(file.image),
    making: file.image ? undefined : SHARE_WORDS.making,
    failed: failed || file.failed,
  };
};

/**
 * The card's image as a file, made once the card is ready and held by this button alone: a card drawn for another
 * day, game or player is another button's, and never this one's file.
 */
const useCardFile = (card: RefObject<HTMLElement>, size: CardSize, fileName: string, ready: boolean) => {
  const [made, setMade] = useState<{ image: File | null; failed: boolean }>({ image: null, failed: false });
  useEffect(() => {
    const node = card.current;
    if (!ready || !node) return;
    let current = true;
    cardFile(node, size, fileName).then(
      (image) => current && setMade({ image, failed: false }),
      () => current && setMade({ image: null, failed: true }),
    );
    return () => {
      current = false;
    };
  }, [card, size, fileName, ready]);
  return made;
};
