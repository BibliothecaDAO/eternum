import { useGame } from "@/hooks/context/game-context";
import { formatAmount } from "@/ui/design-system/kit/amount";
import { Chip, FullIn } from "@/ui/design-system/kit/chip";
import { ARMY, ESSENCE, LABOR, STAMINA } from "@/ui/design-system/kit/words";
import { configManager, entityMapPosition, expeditionDepth } from "@bibliothecadao/eternum";
import { RESOURCE_PRECISION } from "@bibliothecadao/types";

import { useExpeditionRules } from "../frontier-home";
import { useRevealYield } from "../frontier-reveal-yield";
import type { DockArmy } from "./dock-armies";

/**
 * The action bar while an army is selected and no order is pending: what the army can still do, its stamina, when
 * the bar is full, and what each reveal sends home (null in a game whose reveals pay no supplies).
 */
export const ArmyStatusBar = ({
  stamina,
  secondsToFull,
  revealYield,
  onOpen,
}: {
  stamina: number | undefined;
  secondsToFull: number | undefined;
  revealYield: number | undefined | null;
  /** A tap opens the army: its tiers and Upgrade. */
  onOpen?: () => void;
}) => (
  <button
    type="button"
    aria-label={ARMY}
    disabled={!onOpen}
    onClick={onOpen}
    className="frontier-card pointer-events-auto flex h-11 w-full items-center justify-center gap-1.5 !rounded-xl px-1"
  >
    <Chip icons={["St"]} label={STAMINA} value={formatAmount(stamina)} />
    {secondsToFull !== undefined && secondsToFull > 0 && <FullIn seconds={secondsToFull} />}
    {revealYield !== null && (
      <Chip
        icons={["Es", "La"]}
        label={`${ESSENCE}, ${LABOR}`}
        value={revealYield === undefined ? "—" : `+${formatAmount(revealYield)}`}
      />
    )}
  </button>
);

/** The selected army's status bar over the game's facts; a tap opens the army. */
export const SelectedArmyBar = ({ army, onOpen }: { army: DockArmy; onOpen: () => void }) => (
  <ArmyStatusBar
    stamina={army.stamina?.current}
    secondsToFull={army.secondsToFull}
    revealYield={useArmyRevealYield(army)}
    onOpen={onOpen}
  />
);

/** What the army's next reveal sends home at the depth it stands on, in whole units. */
export const useArmyRevealYield = (army: DockArmy): number | undefined | null => {
  const { setup } = useGame();
  const rules = useExpeditionRules();
  const coord = entityMapPosition(setup.store, configManager.getActiveGameId(), army.explorerId);
  const scaled = useRevealYield(army.troopsFact, rules ? expeditionDepth(rules, coord) : 0);
  if (scaled === null || scaled === undefined) return scaled;
  return Number(scaled / BigInt(RESOURCE_PRECISION));
};
