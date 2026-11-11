import { useState } from "react";

import { SHARE_WORDS } from "@/ui/design-system/kit/words";
import { cardFile, type CardSize } from "@/utils/card-image";

import { usePreparedCard } from "./prepared-card";

/**
 * Share through the device's own share sheet (a phone's, and the iOS app's, whose web view opens iOS's own): the card's
 * image, the post's line and its link, to whichever app the player picks there. The image is the card as it is drawn
 * at the press, made before it (usePreparedCard), because a phone opens its sheet only within the press itself;
 * `making` says so until then. `onPress` hears the press; `onShared` only a share the sheet carried out, never one the
 * player closed. Each surface draws the button in its own kit's (a Frontier day's in the HUD's, the season's recap in
 * the app's).
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
  card: HTMLElement | null;
  size: CardSize;
  fileName: string;
  line: string;
  url: string;
  /** Whether the card shows all it will (every input it draws has answered): the image is made only then. */
  ready: boolean;
  onPress?: () => void;
  onShared?: () => void;
}) => {
  const prepared = usePreparedCard(card, ready, (node) => cardFile(node, size, fileName));
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
    share: () => {
      const image = prepared.take();
      if (image) void share(image);
    },
    making: prepared.image ? undefined : SHARE_WORDS.making,
    failed: failed || prepared.failed,
  };
};
