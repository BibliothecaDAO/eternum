import "./share-steps.css";

import { useState } from "react";

import { SHARE_WORDS } from "@/ui/design-system/kit/words";
import { canCopyCard, copyCardImage, saveCardImage, type CardSize } from "@/utils/card-image";
import { openXPost } from "@/utils/x-post";

/** The order of sharing, said once before the two steps: copy (or save) the image, then post. */
export const shareHint = () => (canCopyCard() ? SHARE_WORDS.copyHint : SHARE_WORDS.saveHint);

/**
 * Sharing a card, the owner's flow (4 November 2026): 1, `take` puts the card's image on the clipboard (saves it, where
 * the clipboard takes no PNG); 2, `post` opens a post on X with the card's line and its link, where the player pastes
 * the image. The image is made on the press that asks for it. `onPost` hears the post open, in the same press. Each
 * surface draws the two steps in its own kit's buttons (the season's recap in the app's, a Frontier day in the HUD's),
 * with `word` and StepNumber.
 */
export const useShareSteps = ({
  card,
  size,
  fileName,
  line,
  url,
  onPost,
}: {
  card: HTMLElement | null;
  size: CardSize;
  fileName: string;
  line: string;
  url: string;
  onPost?: () => void;
}) => {
  const [state, setState] = useState<"idle" | "making" | "taken" | "failed">("idle");
  const copies = canCopyCard();
  const take = async () => {
    if (!card) return;
    setState("making");
    const taken = copies ? copyCardImage(card, size) : saveCardImage(card, size, fileName);
    setState(
      await taken.then(
        () => "taken" as const,
        () => "failed" as const,
      ),
    );
  };
  const post = () => {
    openXPost(line, url);
    onPost?.();
  };
  return {
    take: () => void take(),
    post,
    making: state === "making" ? SHARE_WORDS.making : undefined,
    failed: state === "failed",
    word: takeWord(copies, state === "taken"),
  };
};

/** The first step's word: copy or save, then copied or saved once done. */
const takeWord = (copies: boolean, taken: boolean) =>
  copies ? (taken ? SHARE_WORDS.copied : SHARE_WORDS.copy) : taken ? SHARE_WORDS.saved : SHARE_WORDS.save;

/** A step's number at the start of its button. */
export const StepNumber = ({ number }: { number: number }) => (
  <b className="share-steps__number" aria-hidden>
    {number}
  </b>
);
