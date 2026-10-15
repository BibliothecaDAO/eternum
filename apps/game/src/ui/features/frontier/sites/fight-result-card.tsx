import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { formatExact } from "@/ui/design-system/kit/amount";
import { Chip } from "@/ui/design-system/kit/chip";

import {
  ARMY,
  ARMY_LOST,
  FULL,
  GUARD_HOLDS,
  REST_DID_NOT_FIT,
  STORE,
  TROOPS,
  VICTORY,
  XP,
} from "@/ui/design-system/kit/words";

import type { ReactNode } from "react";

import type { TroopsChange } from "./fight-record";
import type { FightResult, FightVerdict } from "./fight-result";
import { TARGET_MARKS } from "./site-marks";

export const VERDICT_WORDS: Record<FightVerdict, string> = {
  victory: VICTORY,
  "army-lost": ARMY_LOST,
  "guard-holds": GUARD_HOLDS,
};

const VERDICT_TONES: Record<FightVerdict, string> = {
  victory: "text-kit-gold2",
  "army-lost": "text-kit-red",
  "guard-holds": "text-kit-cream",
};

/**
 * How an attack ended, in the sheet that sent it: the one word, then each side's troops before and after as the
 * battle recorded them (the army alone when no record of the battle is known), and on a clear what its own record
 * says it paid, marked Full when the store that took it is at its limit, with its XP. It stays until the player taps
 * it away.
 */
export const FightResultCard = ({ result, onClose }: { result: FightResult; onClose: () => void }) => {
  const { word, icon } = TARGET_MARKS[result.site];
  const verdict = VERDICT_WORDS[result.verdict];
  return (
    <button
      type="button"
      aria-label={`${word}: ${verdict}`}
      onClick={onClose}
      className="flex w-full flex-col gap-2 text-left"
    >
      <span className="flex items-center gap-3">
        <span className="relative flex size-16 shrink-0 items-center justify-center rounded-xl border border-kit-line2 bg-kit-ground">
          <SemanticIcon name={icon} size={36} />
          {result.verdict === "victory" && (
            <SemanticIcon name="flag" size={22} className="absolute bottom-0.5 right-0.5" />
          )}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className={cn("frontier-title", VERDICT_TONES[result.verdict])}>{verdict}</span>
          <span className="text-sm text-kit-muted">{word}</span>
        </span>
      </span>
      <span className="flex gap-2">
        <Side
          label={ARMY}
          mark={<SemanticIcon name={result.armyArt} alt="" className="size-7 rounded-full object-cover" />}
          troops={result.army}
        />
        {result.guard && <Side label={TROOPS} mark={<SemanticIcon name="troops" size={24} />} troops={result.guard} />}
      </span>
      {result.gained && (
        <span className="frontier-card flex h-14 items-center justify-center gap-3 !rounded-xl !border-2 !border-kit-gold">
          {result.gained.pay && (
            <span className="flex items-center gap-1.5">
              <SemanticIcon name={result.gained.pay.icon} size={26} />
              <span className="text-[24px] leading-none tabular-nums text-kit-gold2">
                +{formatExact(result.gained.pay.amount)}
              </span>
              {result.gained.pay.storeFull && (
                <Chip icons={[]} label={STORE} value={FULL} ember tip={REST_DID_NOT_FIT} />
              )}
            </span>
          )}
          <Chip icons={[]} label={XP} value={`+${formatExact(result.gained.xp)}`} unit={XP} />
        </span>
      )}
    </button>
  );
};

/** One side of the fight: its troops before the battle, and what is left of them, in red when none are. */
const Side = ({ label, mark, troops }: { label: string; mark: ReactNode; troops: TroopsChange }) => (
  <span
    role="img"
    aria-label={`${label} ${formatExact(troops.before)} → ${formatExact(troops.after)}`}
    className="frontier-card flex h-16 min-w-0 flex-1 items-center justify-center gap-2 !rounded-xl"
  >
    {mark}
    <span aria-hidden className="flex items-baseline gap-1.5 tabular-nums">
      <span className="text-base text-kit-muted">{formatExact(troops.before)}</span>
      <span className="text-sm text-kit-muted">→</span>
      <span className={cn("text-xl leading-none", troops.after === 0 ? "text-kit-red" : "text-kit-cream")}>
        {formatExact(troops.after)}
      </span>
    </span>
  </span>
);
