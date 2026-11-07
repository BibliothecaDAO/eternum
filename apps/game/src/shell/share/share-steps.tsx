import "./share-steps.css";

import { useState, type RefObject } from "react";

import { AppButton } from "@/ui/design-system/kit/app-elements";
import { SHARE_WORDS } from "@/ui/design-system/kit/words";
import { canCopyCard, copyCardImage, saveCardImage, type CardSize } from "@/utils/card-image";
import { openXPost } from "@/utils/x-post";

import { FailureLine } from "../sign-in/failure-line";

/** The order of sharing, said once before the two steps: copy (or save) the image, then post. */
export const shareHint = () => (canCopyCard() ? SHARE_WORDS.copyHint : SHARE_WORDS.saveHint);

/**
 * Sharing a card, the owner's flow (4 November 2026): 1, Copy image puts the card's image on the clipboard (Save image
 * saves it, where the clipboard takes no PNG); 2, Post on X opens a post with the card's line and its link, where the
 * player pastes the image. The image is made on the press that asks for it; one that cannot be made says so. `onPost`
 * hears the post open, in the same press. `icons`: room for each button's icon beside its words (a desktop's row).
 */
export const ShareSteps = ({
  card,
  size,
  fileName,
  line,
  url,
  icons,
  postKind = "primary",
  onPost,
}: {
  card: RefObject<HTMLElement>;
  size: CardSize;
  fileName: string;
  line: string;
  url: string;
  icons: boolean;
  /** Post on X is the sheet's one verb, unless another (a phone's Share) stands above it. */
  postKind?: "primary" | "secondary";
  onPost?: () => void;
}) => {
  const [state, setState] = useState<"idle" | "making" | "taken" | "failed">("idle");
  const copies = canCopyCard();
  const take = async () => {
    if (!card.current) return;
    setState("making");
    const taken = copies ? copyCardImage(card.current, size) : saveCardImage(card.current, size, fileName);
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
  return (
    <>
      <AppButton
        kind="secondary"
        icon={icons ? "copy" : undefined}
        busy={state === "making" ? SHARE_WORDS.making : undefined}
        onClick={() => void take()}
      >
        <StepNumber number={1} />
        {takeWord(copies, state === "taken")}
      </AppButton>
      <AppButton kind={postKind} icon={icons ? "twitter" : undefined} onClick={post}>
        <StepNumber number={2} />
        {SHARE_WORDS.post}
      </AppButton>
      {state === "failed" && <FailureLine line={SHARE_WORDS.failed} />}
    </>
  );
};

/** The first step's word: copy or save, then copied or saved once done. */
const takeWord = (copies: boolean, taken: boolean) =>
  copies ? (taken ? SHARE_WORDS.copied : SHARE_WORDS.copy) : taken ? SHARE_WORDS.saved : SHARE_WORDS.save;

const StepNumber = ({ number }: { number: number }) => (
  <b className="share-steps__number" aria-hidden>
    {number}
  </b>
);
