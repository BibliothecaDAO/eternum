import { useGame } from "@/hooks/context/game-context";
import { useSelectArmyOnMap } from "@/hooks/helpers/use-navigate";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { requestOrderAt } from "@/three/scenes/worldmap-order-request";
import { HudButton, HudIconButton, HudPanel } from "@/ui/design-system/kit/hud-elements";
import { CANCEL, PICKED_ARMY, TRANSFER_TROOPS } from "@/ui/design-system/kit/words";
import { ActionPaths, ActionType, configManager, Position } from "@bibliothecadao/eternum";

import { attributeBadgeTarget } from "../attributes/attributes";
import { ArmyToken } from "./army-token";
import type { DockArmy } from "./dock-armies";

/**
 * A phone's picked army, in the dock's place (owner, 22 October 2026: mobile direction A): the army (a tap lets it
 * go, and the dock comes back), how to give it an order, and its details, which open only when asked for.
 */
export const PickedArmy = ({ army, onDetails }: { army: DockArmy; onDetails: () => void }) => (
  <HudPanel collapsible={false} className="pointer-events-auto" bodyClassName="flex items-center gap-2">
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
    <span className="min-w-0 flex-1 text-hud-label text-hud-muted">{PICKED_ARMY.hint}</span>
    <HudIconButton icon="info" label={PICKED_ARMY.details(army.label)} onClick={onDetails} />
  </HudPanel>
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
 * between them (the transfer's card). Beside a holding only the transfer is offered.
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
          {tapped ? TRANSFER_TROOPS.beside(tapped.label, picked.label) : TRANSFER_TROOPS.title}
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
