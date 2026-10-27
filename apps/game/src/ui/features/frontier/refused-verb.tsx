import type { IconMeaning } from "@/ui/design-system/icon";
import { HudButton, HudNotice, HudWindowFoot } from "@/ui/design-system/kit/hud-elements";
import { shortfallLine } from "@/ui/design-system/kit/reasons";
import type { Refusal } from "@/ui/design-system/kit/refusal";

/**
 * A Frontier verb that cannot run yet still ends its sheet, in the sheet's foot so it never scrolls out of view: the one
 * line that says why ("Needs 24K Essence, have 22.8K"), the fix where there is one, and the verb itself, dimmed. What
 * the realm holds is the top bar's, and the shortfall names the price that stops it, so no price line repeats them
 * (owner, 27 October: "just need x essence, have x is alright, then research x").
 */
export const RefusedVerb = ({ word, icon, refusal }: { word: string; icon?: IconMeaning; refusal: Refusal }) => (
  <HudWindowFoot
    note={
      <HudNotice
        tone="warn"
        line={refusal.reason.kind === "short" ? shortfallLine(refusal.reason) : refusal.reason.line}
      />
    }
  >
    {refusal.fix && (
      <HudButton kind="secondary" icon={refusal.fix.icon} onClick={refusal.fix.onFix}>
        {refusal.fix.word}
      </HudButton>
    )}
    <HudButton kind="primary" icon={icon} disabled>
      {word}
    </HudButton>
  </HudWindowFoot>
);
