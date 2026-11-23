import { HudNotice } from "@/ui/design-system/kit/hud-elements";
import { OPENING_WORDS, type OpeningRules } from "@/ui/design-system/kit/words";

import { OPENING, type OpeningMoment } from "./opening";

/** The one line a moment brings, over the map as a notice, with the press that puts it away. */
export const OpeningLineView = ({
  moment,
  rules,
  onGotIt,
}: {
  moment: OpeningMoment;
  rules: OpeningRules;
  onGotIt: () => void;
}) => (
  <HudNotice
    icon={OPENING[moment].icon}
    line={OPENING_WORDS.lines[moment](rules)}
    fix={{ label: OPENING_WORDS.gotIt, onClick: onGotIt }}
  />
);
