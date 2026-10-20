import type { IconMeaning } from "@/ui/design-system/icon";
import { HudButton, HudCost, HudNotice } from "@/ui/design-system/kit/hud-elements";
import { costLine, type Price } from "@/ui/design-system/kit/price-faces";
import { shortfallLine } from "@/ui/design-system/kit/reasons";
import type { Refusal } from "@/ui/design-system/kit/refusal";

/**
 * A Frontier verb that cannot run yet still ends its sheet: the verb itself, dimmed, with what it costs under it; then
 * the one line that says why; and the fix where there is one, with its own cost.
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
  <>
    <HudButton kind="primary" icon={icon} disabled>
      {word}
    </HudButton>
    <HudCost line={costLine(prices)} />
    <HudNotice
      tone="warn"
      line={refusal.reason.kind === "short" ? shortfallLine(refusal.reason) : refusal.reason.line}
    />
    {refusal.fix && (
      <>
        <HudButton kind="secondary" icon={refusal.fix.icon} onClick={refusal.fix.onFix}>
          {refusal.fix.word}
        </HudButton>
        <HudCost line={costLine(refusal.fix.prices ?? [])} />
      </>
    )}
  </>
);
