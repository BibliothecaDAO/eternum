import { formatExact } from "@bibliothecadao/types";
import { Icon as SemanticIcon, type IconMeaning } from "@/ui/design-system/icon";
import { HudCard, HudChip, HudRarity } from "@/ui/design-system/kit/hud-elements";
import type { Tier } from "@/ui/design-system/kit/tier-chip";
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
  mark: IconMeaning;
  attribute: string;
  /** The attribute's effect at the tier now and next, as the preset's table says it. */
  effect: string;
  /** The XP each new army no longer has to spend on this tier; unknown is undefined. */
  xpSaved: number | undefined;
  tier: Tier;
  /** The realm's army portrait. */
  armyArt: IconMeaning;
  /** The Scouts' lodge: the kind this tier lifts, chosen with it. */
  kinds?: ReactNode;
}) => (
  <>
    <div className="flex items-center justify-center gap-2">
      <HudChip icons={[mark]} label={attribute}>
        {effect}
      </HudChip>
      <HudChip>{`${formatExact(xpSaved)} ${XP}`}</HudChip>
    </div>
    {kinds ?? (
      <div className="flex items-center gap-2">
        <NextArmy art={armyArt} mark={mark} tier={tier} />
        <span aria-hidden className="text-hud-muted">
          →
        </span>
        <NextArmy art={armyArt} mark={mark} tier={(tier + 1) as Tier} lit />
      </div>
    )}
  </>
);

/** The next army as it would deploy: its portrait, the attribute's mark and its starting tier; the next one lit. */
const NextArmy = ({
  art,
  mark,
  tier,
  lit = false,
}: {
  art: IconMeaning;
  mark: IconMeaning;
  tier: Tier;
  lit?: boolean;
}) => (
  <div className="flex-1">
    <HudCard
      title={
        <span className="flex items-center justify-center gap-2">
          <SemanticIcon name={mark} size={22} />
          <HudRarity tier={tier} />
        </span>
      }
      picture={<SemanticIcon name={art} alt="" size={32} />}
      selected={lit}
    />
  </div>
);
