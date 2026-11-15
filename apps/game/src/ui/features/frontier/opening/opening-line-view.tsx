import { HudNotice } from "@/ui/design-system/kit/hud-elements";
import { OPENING_WORDS, type OpeningRules } from "@/ui/design-system/kit/words";

import { OPENING, type OpeningMoment } from "./opening";

/** The one line a moment brings, over the map as a notice, with the press that puts it away. */
export const OpeningLineView = ({
  moment,
  rules,
  offer,
  onGotIt,
}: {
  moment: OpeningMoment;
  rules: OpeningRules;
  /** What the line offers beside it, one press to accept; Got it leaves it. */
  offer?: { line: string; accept: string; onAccept: () => void };
  onGotIt: () => void;
}) => (
  <>
    <HudNotice
      icon={OPENING[moment].icon}
      line={OPENING_WORDS.lines[moment](rules)}
      fix={{ label: OPENING_WORDS.gotIt, onClick: onGotIt }}
    />
    {offer && (
      <HudNotice icon="notifications" line={offer.line} fix={{ label: offer.accept, onClick: offer.onAccept }} />
    )}
  </>
);
