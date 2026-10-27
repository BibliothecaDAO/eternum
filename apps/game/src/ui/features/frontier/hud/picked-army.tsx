import { useUIStore } from "@/hooks/store/use-ui-store";
import { HudIconButton, HudPanel } from "@/ui/design-system/kit/hud-elements";
import { PICKED_ARMY } from "@/ui/design-system/kit/words";

import { attributeBadgeTarget } from "../attributes/attributes";
import { ArmyToken } from "./army-token";
import type { DockArmy } from "./dock-armies";

/**
 * A phone's picked army, in the dock's place (owner, 22 October 2026: mobile direction A): the army (a tap lets it
 * go, and the dock comes back), and its details, which open only when asked for.
 */
export const PickedArmy = ({ army, onDetails }: { army: DockArmy; onDetails: () => void }) => (
  <HudPanel collapsible={false} className="pointer-events-auto" bodyClassName="flex items-center justify-between gap-2">
    <ArmyToken
      label={PICKED_ARMY.letGo(army.label)}
      number={army.number}
      art={army.art}
      xp={army.xp}
      xpGoal={army.xpGoal}
      stamina={army.stamina}
      troops={army.troops}
      canBuyTier={army.canBuyTier}
      selected
      flyTarget={attributeBadgeTarget(army.explorerId)}
      onPick={() => useUIStore.getState().deselectEntity()}
    />
    <HudIconButton icon="info" label={PICKED_ARMY.details(army.label)} onClick={onDetails} />
  </HudPanel>
);
