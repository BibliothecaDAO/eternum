import { HudButton } from "@/ui/design-system/kit/hud-elements";
import { openXPost } from "@/utils/x-post";

/**
 * Shares a line on X: the sheet's secondary button, opening X's compose page in a new tab, so the game stays where it
 * was. The line is written when Share is pressed, never before: a name in it reads as it stands then, never as it stood
 * when the sheet drew (a name still on its way).
 */
const TwitterShareButton = ({
  text,
  callToActionText = "Share",
}: {
  text: () => string;
  callToActionText?: string;
}) => (
  <HudButton kind="secondary" icon="twitter" onClick={() => openXPost(text())}>
    {callToActionText}
  </HudButton>
);

export default TwitterShareButton;
