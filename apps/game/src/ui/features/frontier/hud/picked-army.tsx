import { Icon } from "@/ui/design-system/icon";
import { HudPanel, HudTier } from "@/ui/design-system/kit/hud-elements";
import { PICKED_ARMY, type Rank, tierNumeral } from "@/ui/design-system/kit/words";
import type { ReactNode } from "react";

import { ATTRIBUTE_LIST, type AttributeKey } from "../army/army-detail";
import { LevelUpButton } from "../army/army-panel";
import { attributeBadgeTarget } from "../attributes/attributes";
import { ArmyToken } from "./army-token";
import type { DockArmy } from "./dock-armies";

/** What the picked army's row reads of an army: the dock's own, so the lab draws it on its fiction. */
export type PickedArmyView = Pick<
  DockArmy,
  | "explorerId"
  | "label"
  | "number"
  | "art"
  | "xp"
  | "xpGoal"
  | "stamina"
  | "secondsToFull"
  | "troops"
  | "canSpendSkillPoint"
  | "tiers"
>;

/**
 * A phone's picked army, in the dock's place (owner, 22 October 2026: mobile direction A; 27 October: D, its stamina
 * over Level up): its token, a tap opening its card; its four sides with their tiers, which the token does not show;
 * then its stamina, which is its refill, over Level up. Level up opens the card on its choices while a skill point can be spent, else the card. A tap on an empty tile lets the army go, and the dock comes back.
 */
export const PickedArmy = ({
  army,
  refill,
  onDetails,
  onLevelUp,
}: {
  army: PickedArmyView;
  /** The army's stamina as its refill's button. */
  refill: ReactNode;
  onDetails: () => void;
  onLevelUp: () => void;
}) => (
  <HudPanel collapsible={false} className="pointer-events-auto" bodyClassName="flex items-center gap-3 pt-3">
    <ArmyToken
      label={PICKED_ARMY.details(army.label)}
      number={army.number}
      art={army.art}
      xp={army.xp}
      xpGoal={army.xpGoal}
      stamina={army.stamina}
      troops={army.troops}
      canSpendSkillPoint={army.canSpendSkillPoint}
      selected
      flyTarget={attributeBadgeTarget(army.explorerId)}
      onPick={onDetails}
    />
    <span data-picked-army className="min-w-0 flex-1">
      {army.tiers && <Sides tiers={army.tiers} />}
    </span>
    <span className="grid w-24 shrink-0 gap-1.5">
      {refill}
      <LevelUpButton affordable={army.canSpendSkillPoint} onPress={onLevelUp} />
    </span>
  </HudPanel>
);

/** The army's sides, every attribute the game levels, each its mark over its tier's gem. */
const Sides = ({ tiers }: { tiers: Record<AttributeKey, number> }) => (
  <span className="grid grid-cols-4 gap-1">
    {ATTRIBUTE_LIST.map(({ key, name, mark }) => (
      <span
        key={key}
        role="img"
        aria-label={`${name} ${tierNumeral(tiers[key] as Rank)}`}
        className="flex flex-col items-center gap-1"
      >
        <Icon name={mark} size={28} />
        <HudTier tier={tiers[key] as Rank} />
      </span>
    ))}
  </span>
);
