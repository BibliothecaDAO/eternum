import { type IconMeaning } from "@/ui/design-system/icon";
import { Button, type Price } from "./button";

import { ReasonPlate } from "./reason-plate";
import type { Reason } from "./reasons";

/** The step that fixes a refusal: its word, its price where it has one, and its way. */
export type Fix = { word: string; icon?: IconMeaning; prices?: readonly Price[]; onFix: () => void };

/** Why a verb cannot run, and the fix where there is one. */
export type Refusal = { reason: Reason; fix?: Fix };

/** The fix on the gold button. */
export const FixButton = ({ fix }: { fix: Fix }) => (
  <Button role="primary" icon={fix.icon} word={fix.word} prices={fix.prices} onClick={fix.onFix} />
);

/**
 * A verb that cannot run yet still ends its panel: the verb itself, dimmed, carrying its price; under it the one line
 * that says why; and the fix on a gold button where there is one.
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
    <Button role="primary" icon={icon} word={word} prices={prices} disabled />
    <ReasonPlate reason={refusal.reason} />
    {refusal.fix && <FixButton fix={refusal.fix} />}
  </>
);
