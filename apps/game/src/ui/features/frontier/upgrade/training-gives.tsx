import { formatExact } from "@/ui/design-system/kit/amount";
import { Chip } from "@/ui/design-system/kit/chip";
import { type IconCode, KitIcon } from "@/ui/design-system/kit/kit-icon";
import { type Tier, TierChip } from "@/ui/design-system/kit/tier-chip";
import { XP } from "@/ui/design-system/kit/words";
import type { ReactNode } from "react";

/**
 * What a training building's next tier gives (wireframe 10): its attribute's effect before and after, the XP it saves
 * every army every day, and the next army's starting tier now and next; the Scouts' lodge chooses the kind instead.
 */
export const TrainingGives = ({
  mark,
  attribute,
  effect,
  xpSaved,
  tier,
  armyArt,
  kinds,
}: {
  mark: IconCode;
  attribute: string;
  /** The attribute's effect at the tier now and next, as the preset's table says it. */
  effect: string;
  /** The XP each new army no longer has to spend on this tier; unknown is undefined. */
  xpSaved: number | undefined;
  tier: Tier;
  /** The realm's army portrait. */
  armyArt: string;
  /** The Scouts' lodge: the kind this tier lifts, chosen with it. */
  kinds?: ReactNode;
}) => (
  <>
    <div className="flex items-center justify-center gap-2">
      <Chip icons={[mark]} label={attribute} value={effect} />
      <Chip icons={[]} label={XP} value={formatExact(xpSaved)} unit={XP} />
    </div>
    {kinds ?? (
      <div className="flex items-center gap-2">
        <NextArmy art={armyArt} mark={mark} tier={tier} />
        <span aria-hidden className="text-[18px] text-kit-muted">
          →
        </span>
        <NextArmy art={armyArt} mark={mark} tier={(tier + 1) as Tier} lit />
      </div>
    )}
  </>
);

/** The next army as it would deploy: its portrait, the attribute's mark and its starting tier. */
const NextArmy = ({ art, mark, tier, lit = false }: { art: string; mark: IconCode; tier: Tier; lit?: boolean }) => (
  <span
    className={
      lit
        ? "frontier-card flex h-14 flex-1 items-center justify-center gap-2 !rounded-xl !border-[3px] !border-kit-hot"
        : "frontier-card flex h-14 flex-1 items-center justify-center gap-2 !rounded-xl"
    }
  >
    <img src={art} alt="" className="size-8 rounded-full object-cover" />
    <KitIcon code={mark} size={22} />
    <TierChip tier={tier} showWord={false} />
  </span>
);
