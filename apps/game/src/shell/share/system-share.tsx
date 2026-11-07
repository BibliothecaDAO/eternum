import { useQuery } from "@tanstack/react-query";
import { useState, type RefObject } from "react";

import { AppButton } from "@/ui/design-system/kit/app-elements";
import { SHARE_WORDS } from "@/ui/design-system/kit/words";
import { cardFile, type CardSize } from "@/utils/card-image";

import { FailureLine } from "../sign-in/failure-line";

/**
 * Share, through the device's own share sheet (a phone's): the card's image, the post's line and its link, to whichever
 * app the player picks there (X, WhatsApp, Telegram, Discord). The image is made before the press, while the button
 * says so, because a phone opens its sheet only within the press itself. A player who closes the sheet has shared
 * nothing; `onShared` hears only a share the sheet carried out.
 */
export const SystemShare = ({
  card,
  size,
  fileName,
  line,
  url,
  ready,
  onShared,
}: {
  card: RefObject<HTMLElement>;
  size: CardSize;
  fileName: string;
  line: string;
  url: string;
  /** Whether the card says all it will (its player's name read): the image is made only then. */
  ready: boolean;
  onShared: () => void;
}) => {
  const [failed, setFailed] = useState(false);
  const file = useQuery({
    queryKey: ["shareFile", fileName, size.width, size.height],
    queryFn: () => cardFile(card.current!, size, fileName),
    enabled: ready && card.current !== null,
    staleTime: Number.POSITIVE_INFINITY,
    retry: 1,
  });
  const share = async (image: File) => {
    setFailed(false);
    try {
      await navigator.share({ files: [image], text: line, url });
      onShared();
    } catch (error) {
      // Closing the sheet is the player's choice, not a failure.
      if ((error as { name?: string }).name !== "AbortError") setFailed(true);
    }
  };
  return (
    <>
      <AppButton
        kind="primary"
        icon="share"
        busy={file.data ? undefined : SHARE_WORDS.making}
        onClick={() => file.data && void share(file.data)}
      >
        {SHARE_WORDS.share}
      </AppButton>
      {(failed || file.isError) && <FailureLine line={SHARE_WORDS.shareFailed} />}
    </>
  );
};
