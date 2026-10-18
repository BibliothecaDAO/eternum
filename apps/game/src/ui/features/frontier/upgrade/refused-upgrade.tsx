import type { Price } from "../hud-prices";
import { HudButton, HudNotice } from "@/ui/design-system/kit/hud-elements";
import { shortfallLine } from "@/ui/design-system/kit/reason-plate";
import type { Refusal } from "@/ui/design-system/kit/refused-verb";

import { hudPrices } from "../hud-prices";

/**
 * An Upgrade that cannot run yet still ends its sheet: the verb itself, dimmed, carrying its price; under it the one
 * line that says why; and the fix where there is one.
 */
export const RefusedUpgrade = ({
  word,
  prices,
  refusal,
}: {
  word: string;
  prices: readonly Price[];
  refusal: Refusal;
}) => (
  <>
    <HudButton kind="primary" prices={hudPrices(prices)} disabled>
      {word}
    </HudButton>
    <HudNotice
      tone="warn"
      line={refusal.reason.kind === "short" ? shortfallLine(refusal.reason) : refusal.reason.line}
    />
    {refusal.fix && (
      <HudButton
        kind="secondary"
        icon={refusal.fix.icon}
        prices={hudPrices(refusal.fix.prices ?? [])}
        onClick={refusal.fix.onFix}
      >
        {refusal.fix.word}
      </HudButton>
    )}
  </>
);
