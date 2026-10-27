import { formatCharge, formatShort } from "@bibliothecadao/types";
import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HudChip, HudPanel } from "@/ui/design-system/kit/hud-elements";

import { ARMY, FULL, REST_DID_NOT_FIT, STORAGE, TROOPS, XP } from "@/ui/design-system/kit/words";

import { FightSide } from "./fight-side";
import type { FightResult } from "./fight-result";
import { SiteMark } from "./site-card-view";
import { TARGET_MARKS, attackTargetName } from "./site-marks";

import { VERDICT_WORDS } from "@bibliothecadao/types";

const VERDICT_TONES: Record<FightResult["verdict"], string> = {
  victory: "text-hud-gold",
  "army-lost": "text-hud-bad",
};

/**
 * How an attack ended, in the sheet that sent it: the one word, then each side's troops before and after as the
 * battle recorded them (the army alone when no record of the battle is known), and on a clear what its own record
 * says it paid, marked Full when the store that took it is at its limit, with its XP. It stays until the player taps
 * it away.
 */
export const FightResultCard = ({ result, onClose }: { result: FightResult; onClose: () => void }) => {
  const { icon } = TARGET_MARKS[result.site];
  const word = attackTargetName(result.site, result.guardIdentity);
  const verdict = VERDICT_WORDS[result.verdict];
  return (
    <button
      type="button"
      aria-label={`${word}: ${verdict}`}
      onClick={onClose}
      className="flex w-full flex-col gap-2 text-left"
    >
      <span className="flex items-center gap-3">
        <SiteMark icon={result.guardIdentity?.art ?? icon}>
          {result.verdict === "victory" && (
            <SemanticIcon name="flag" size={22} className="absolute bottom-0.5 right-0.5" />
          )}
        </SiteMark>
        <span className={cn("text-hud-title", VERDICT_TONES[result.verdict])}>{verdict}</span>
      </span>
      <span className="flex gap-2">
        <FightSide
          label={ARMY}
          mark={<SemanticIcon name={result.armyArt} alt="" className="size-7 rounded-full object-cover" />}
          before={result.army.before}
          kept={result.army.after}
          side="ours"
        />
        {result.guard && (
          <FightSide
            label={result.guardIdentity?.name ?? TROOPS}
            mark={<SemanticIcon name={result.guardIdentity?.art ?? "troops"} size={24} />}
            before={result.guard.before}
            kept={result.guard.after}
            side="theirs"
          />
        )}
      </span>
      {result.gained && (
        <HudPanel collapsible={false} bodyClassName="flex h-14 items-center justify-center gap-3">
          {result.gained.pay && (
            <span className="flex items-center gap-1.5">
              <SemanticIcon name={result.gained.pay.icon} size={26} />
              <span className="text-hud-display leading-none tabular-nums text-hud-gold">
                +{formatCharge(result.gained.pay.amount)}
              </span>
              {result.gained.pay.storeFull && (
                <HudChip label={STORAGE} tone="bad" tip={REST_DID_NOT_FIT}>
                  {FULL}
                </HudChip>
              )}
            </span>
          )}
          <HudChip>
            {`${formatShort(result.gained.xp, { signed: true })}`} {XP}
          </HudChip>
        </HudPanel>
      )}
    </button>
  );
};
