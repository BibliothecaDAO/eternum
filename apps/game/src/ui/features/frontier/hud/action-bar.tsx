import { useGame } from "@/hooks/context/game-context";
import { HudChip, HudPanel, HudPill } from "@/ui/design-system/kit/hud-elements";
import { ARMY, ESSENCE, LABOR, STAMINA } from "@/ui/design-system/kit/words";
import { configManager, entityMapPosition, expeditionDepth } from "@bibliothecadao/eternum";
import { RESOURCE_PRECISION, formatAmount } from "@bibliothecadao/types";

import { useExpeditionRules } from "../frontier-home";
import { FullIn } from "../full-in";
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
}) => {
  const readings = [
    <HudChip key="stamina" icons={["stamina"]} label={STAMINA}>
      {formatAmount(stamina)}
    </HudChip>,
    secondsToFull !== undefined && secondsToFull > 0 && <FullIn key="full" seconds={secondsToFull} />,
    revealYield !== null && (
      <HudChip key="yield" icons={["essence", "labor"]} label={`${ESSENCE}, ${LABOR}`}>
        {revealYield === undefined ? "—" : `+${formatAmount(revealYield)}`}
      </HudChip>
    ),
  ].filter(Boolean);
  // A tap opens the army; with no way there the bar is only read, on the panel's surface.
  return onOpen ? (
    <HudPill label={ARMY} onPress={onOpen} className="h-11 w-full justify-center">
      {readings}
    </HudPill>
  ) : (
    <HudPanel collapsible={false} label={ARMY} bodyClassName="flex h-11 items-center justify-center gap-1.5">
      {readings}
    </HudPanel>
  );
};

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
