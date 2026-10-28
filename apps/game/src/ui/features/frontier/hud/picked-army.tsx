import { useGame } from "@/hooks/context/game-context";
import { useSelectArmyOnMap } from "@/hooks/helpers/use-navigate";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { requestOrderAt } from "@/three/scenes/worldmap-order-request";
import { Icon } from "@/ui/design-system/icon";
import { HudButton, HudPanel, HudTier } from "@/ui/design-system/kit/hud-elements";
import { CANCEL, PICKED_ARMY, type Tier, tierNumeral, TRANSFER_TROOPS } from "@/ui/design-system/kit/words";
import { ActionPaths, ActionType, configManager, Position } from "@bibliothecadao/eternum";
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
  | "canBuyTier"
  | "tiers"
>;

/**
 * A phone's picked army, in the dock's place (owner, 22 October 2026: mobile direction A; 27 October: D, its stamina
 * over Level up): its token, a tap opening its card; its four sides with their tiers, which the token does not show;
 * then its stamina, which is its refill, over Level up. Level up opens the card on its choices while the XP buys a
 * level, else the card. A tap on an empty tile lets the army go, and the dock comes back.
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
      canBuyTier={army.canBuyTier}
      selected
      flyTarget={attributeBadgeTarget(army.explorerId)}
      onPick={onDetails}
    />
    <span data-picked-army className="min-w-0 flex-1">
      {army.tiers && <Sides tiers={army.tiers} />}
    </span>
    <span className="grid w-24 shrink-0 gap-1.5">
      {refill}
      <LevelUpButton affordable={army.canBuyTier} onPress={onLevelUp} />
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
        aria-label={`${name} ${tierNumeral(tiers[key] as Tier)}`}
        className="flex flex-col items-center gap-1"
      >
        <Icon name={mark} size={28} />
        <HudTier tier={tiers[key] as Tier} />
      </span>
    ))}
  </span>
);

/**
 * Where a phone's tap pinned the picked army's transfer (the Help order beside it): the tile, and the realm's army
 * standing there when it is one (else one of the player's holdings). Null while no transfer is pinned.
 */
export const usePinnedTransfer = (
  armies: readonly DockArmy[],
): { at: { col: number; row: number }; tapped: DockArmy | undefined } | null => {
  const { setup } = useGame();
  const { hoveredHex, actionPaths } = useUIStore((state) => state.entityActions);
  if (!hoveredHex) return null;
  const path = actionPaths.get(ActionPaths.posKey(hoveredHex, true));
  if (!path || ActionPaths.getActionType(path) !== ActionType.Help) return null;
  const contract = Position.fromNormalized({ x: hoveredHex.col, y: hoveredHex.row }).getContract();
  const gameId = configManager.getActiveGameId();
  const tapped = armies.find((army) => {
    const tile = setup.store.entityOccupancy(gameId, army.explorerId);
    return tile?.col === contract.x && tile.row === contract.y;
  });
  return { at: hoveredHex, tapped };
};

/**
 * A phone's tap on another of the realm's armies beside the picked one asks which: pick that army, or move troops
 * between them (the transfer's card). Beside a holding only the transfer is offered, its button naming it once.
 */
export const TransferChoice = ({
  picked,
  choice,
}: {
  picked: DockArmy;
  choice: NonNullable<ReturnType<typeof usePinnedTransfer>>;
}) => {
  const selectArmy = useSelectArmyOnMap();
  const { tapped } = choice;
  return (
    <HudPanel collapsible={false} className="pointer-events-auto" bodyClassName="flex flex-col gap-1.5">
      <span className="flex items-center justify-between gap-2">
        <span className="text-hud-label text-hud-muted">
          {tapped && TRANSFER_TROOPS.beside(tapped.label, picked.label)}
        </span>
        <HudButton kind="quiet" size="sm" onClick={() => useUIStore.getState().updateEntityActionHoveredHex(null)}>
          {CANCEL}
        </HudButton>
      </span>
      <span className={tapped ? "grid grid-cols-2 gap-1.5" : "grid"}>
        {tapped && (
          <HudButton kind="secondary" icon="army" onClick={() => selectArmy(tapped.explorerId)}>
            {TRANSFER_TROOPS.pickArmy(tapped.label)}
          </HudButton>
        )}
        <HudButton kind="primary" icon="transfer" onClick={() => requestOrderAt(choice.at)}>
          {TRANSFER_TROOPS.title}
        </HudButton>
      </span>
    </HudPanel>
  );
};
