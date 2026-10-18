import { HudButton } from "@/ui/design-system/kit/hud-elements";

/**
 * Shares a line on X: the sheet's secondary button, opening X's compose page with `text` in a new tab, so the game
 * stays where it was.
 */
const TwitterShareButton = ({ text, callToActionText = "Share" }: { text: string; callToActionText?: string }) => (
  <HudButton
    kind="secondary"
    icon="twitter"
    onClick={() =>
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer")
    }
  >
    {callToActionText}
  </HudButton>
);

export default TwitterShareButton;
