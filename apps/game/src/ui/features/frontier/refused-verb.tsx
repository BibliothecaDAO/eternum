import type { IconMeaning } from "@/ui/design-system/icon";
import { HudButton, HudWindowFoot } from "@/ui/design-system/kit/hud-elements";
import { type RankedWords, rankedText } from "@/ui/design-system/kit/words";
import { reasonLine } from "@/ui/design-system/kit/reasons";
import type { Refusal } from "@/ui/design-system/kit/refusal";
import type { ReactNode } from "react";

export const RefusedVerb = ({
  word,
  icon,
  refusal,
  note,
}: {
  word: RankedWords | string;
  icon?: IconMeaning;
  refusal: Refusal;
  note?: ReactNode;
}) => (
  <HudWindowFoot note={note}>
    {refusal.fix && (
      <HudButton kind="secondary" icon={refusal.fix.icon} onClick={refusal.fix.onFix}>
        {refusal.fix.word}
      </HudButton>
    )}
    <HudButton kind="primary" tone="bad" icon={icon} aria-label={rankedText(word)} disabled>
      {reasonLine(refusal.reason)}
    </HudButton>
  </HudWindowFoot>
);
