import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { formatExact } from "@/ui/design-system/kit/amount";
import { HudChip, HudPanel } from "@/ui/design-system/kit/hud-elements";

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
import { SiteMark } from "./site-card-view";
import { TARGET_MARKS } from "./site-marks";

export const VERDICT_WORDS: Record<FightVerdict, string> = {
  victory: VICTORY,
  "army-lost": ARMY_LOST,
  "guard-holds": GUARD_HOLDS,
};

const VERDICT_TONES: Record<FightVerdict, string> = {
  victory: "text-hud-gold",
  "army-lost": "text-hud-bad",
  "guard-holds": "text-hud-ink",
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
        <SiteMark icon={icon}>
          {result.verdict === "victory" && (
            <SemanticIcon name="flag" size={22} className="absolute bottom-0.5 right-0.5" />
          )}
        </SiteMark>
        <span className="flex min-w-0 flex-col">
          <span className={cn("text-hud-title", VERDICT_TONES[result.verdict])}>{verdict}</span>
          <span className="text-hud-body text-hud-muted">{word}</span>
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
        <HudPanel collapsible={false} bodyClassName="flex h-14 items-center justify-center gap-3">
          {result.gained.pay && (
            <span className="flex items-center gap-1.5">
              <SemanticIcon name={result.gained.pay.icon} size={26} />
              <span className="text-hud-display leading-none tabular-nums text-hud-gold">
                +{formatExact(result.gained.pay.amount)}
              </span>
              {result.gained.pay.storeFull && (
                <HudChip label={STORE} tone="bad" tip={REST_DID_NOT_FIT}>
                  {FULL}
                </HudChip>
              )}
            </span>
          )}
          <HudChip>
            {`+${formatExact(result.gained.xp)}`} {XP}
          </HudChip>
        </HudPanel>
      )}
    </button>
  );
};

/** One side of the fight: its troops before the battle, and what is left of them, in red when none are. */
const Side = ({ label, mark, troops }: { label: string; mark: ReactNode; troops: TroopsChange }) => (
  <span
    role="img"
    aria-label={`${label} ${formatExact(troops.before)} → ${formatExact(troops.after)}`}
    className="flex min-w-0 flex-1"
  >
    <HudPanel collapsible={false} className="flex-1" bodyClassName="flex h-16 items-center justify-center gap-2">
      {mark}
      <span aria-hidden className="flex items-baseline gap-1.5 tabular-nums">
        <span className="text-hud-body text-hud-muted">{formatExact(troops.before)}</span>
        <span className="text-hud-body text-hud-muted">→</span>
        <span className={cn("text-hud-display leading-none", troops.after === 0 ? "text-hud-bad" : "text-hud-ink")}>
          {formatExact(troops.after)}
        </span>
      </span>
    </HudPanel>
  </span>
);
