import { formatHeldAgainst, formatWait } from "@bibliothecadao/types";

import { PRICE_FACES, type PriceKind } from "./price-faces";
import { inTime, needsHave, needsOverLimit } from "./words";

/**
 * Why a verb cannot run, standing where its button would: either what it needs against what there is (and the exact
 * wait when it fills by itself), or the one line naming what failed.
 */
export type Reason =
  | {
      kind: "short";
      of: PriceKind;
      held: number | undefined;
      need: number;
      counted?: "limit";
      wait?: number;
    }
  | { kind: "failed"; line: string };

export const shortfallLine = ({ of, held, need, counted, wait }: Extract<Reason, { kind: "short" }>): string => {
  const noun = PRICE_FACES[of].word;
  const pair = formatHeldAgainst(held, need);
  const line = counted === "limit" ? needsOverLimit(pair.need, noun, pair.held) : needsHave(pair.need, noun, pair.held);
  return wait === undefined ? line : `${line} · ${inTime(formatWait(wait))}`;
};

/** Any reason in its one line: what is short against what there is, or the line that names what failed. */
export const reasonLine = (reason: Reason): string => (reason.kind === "short" ? shortfallLine(reason) : reason.line);

/** An army short of stamina, as every surface says it: "Needs 50 stamina, have 13 · in 2m". */
export const staminaShortfall = (held: number | undefined, need: number, wait?: number): string =>
  shortfallLine({ kind: "short", of: "stamina", held, need, wait });
