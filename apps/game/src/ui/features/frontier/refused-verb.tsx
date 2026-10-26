import type { IconMeaning } from "@/ui/design-system/icon";
import { HudButton, HudCost, HudNotice, HudWindowFoot } from "@/ui/design-system/kit/hud-elements";
import { costLine, type Price } from "@/ui/design-system/kit/price-faces";
import { shortfallLine } from "@/ui/design-system/kit/reasons";
import type { Refusal } from "@/ui/design-system/kit/refusal";

/**
 * A Frontier verb that cannot run yet still ends its sheet, in the sheet's foot so it never scrolls out of view: the
 * verb itself, dimmed, with what it costs; the one line that says why; and the fix where there is one, with its own
 * cost, beside the verb.
 */
export const RefusedVerb = ({
  word,
  icon,
  prices,
  refusal,
}: {
  word: string;
  icon?: IconMeaning;
  prices: readonly Price[];
  refusal: Refusal;
}) => (
  <HudWindowFoot
    note={
      <span className="flex flex-col items-start gap-1">
        <HudNotice
          tone="warn"
          line={refusal.reason.kind === "short" ? shortfallLine(refusal.reason) : refusal.reason.line}
        />
        <HudCost line={costLine(prices)} />
        {refusal.fix?.prices && <HudCost line={costLine(refusal.fix.prices)} />}
      </span>
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
