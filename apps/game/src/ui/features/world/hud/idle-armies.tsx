import { useGame } from "@/hooks/context/game-context";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { useAllInFlight } from "@/hooks/store/use-actions-in-flight";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useFactView } from "@/hooks/use-fact-view";
import { selectableArmiesView } from "@/sync/fact-views";
import { requestArmySelection } from "@/three/scenes/worldmap-army-select-request";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Icon } from "@/ui/design-system/icon";
import { getExplorerStaminaSnapshot } from "@/utils/explorer-stamina";
import { configManager } from "@bibliothecadao/eternum";
import { resolveExplorerTroops } from "@bibliothecadao/eternum/troop-stamina";
import { useMemo } from "react";

/** One of the player's armies as the idle rule reads it: its stamina now, and whether an order is out or queued. */
interface ArmyReading {
  entityId: number;
  stamina: { current: number; max: number } | null;
  ordered: boolean;
}

/**
 * The owner's idle army (16 October 2026): at full stamina and doing nothing, with no order in flight and none queued
 * behind one. An army that has just moved has spent stamina, so it is not idle until it is full again.
 */
export const idleArmyIds = (armies: readonly ArmyReading[]): number[] =>
  armies
    .filter(({ stamina, ordered }) => !ordered && stamina !== null && stamina.max > 0 && stamina.current >= stamina.max)
    .map(({ entityId }) => entityId);

/** The army to select next: the idle one after the army selected now, or the first. */
export const nextIdleArmy = (idle: readonly number[], selectedArmyId: number | null): number | null => {
  if (idle.length === 0) return null;
  const at = selectedArmyId === null ? -1 : idle.indexOf(selectedArmyId);
  return idle[(at + 1) % idle.length];
};

/** The player's idle armies now, in the order Tab cycles them. */
export const useIdleArmies = (): number[] => {
  const { setup } = useGame();
  const armies = useFactView(selectableArmiesView);
  const timestamp = useCurrentDefaultTick();
  const inFlight = useAllInFlight("army");
  const queued = useUIStore((state) => state.entityActions.nextOrder?.entityId ?? null);
  return useMemo(
    () =>
      idleArmyIds(
        armies.map(({ entityId }) => {
          const explorer = setup.store.get("ExplorerTroops", {
            game_id: configManager.getActiveGameId(),
            explorer_id: entityId,
          });
          const snapshot = explorer
            ? getExplorerStaminaSnapshot({ timestamp, liveTroops: resolveExplorerTroops(setup.store, explorer) })
            : null;
          return {
            entityId,
            stamina: snapshot && { current: snapshot.current, max: snapshot.max },
            ordered: inFlight.has(String(entityId)) || queued === entityId,
          };
        }),
      ),
    [armies, setup.store, timestamp, inFlight, queued],
  );
};

/** Selects the next idle army as Tab selects an army: the camera goes to it and it is selected. */
export const selectNextIdleArmy = (idle: readonly number[]) => {
  const selection = useUIStore.getState().mapSelection;
  const next = nextIdleArmy(idle, selection?.kind === "army" ? Number(selection.entityId) : null);
  if (next !== null) requestArmySelection(next);
};

/** The minimap's Idle armies button: how many wait, and `I` or a click selects the next one. */
export const IdleArmiesButton = ({ idle, className }: { idle: readonly number[]; className?: string }) => (
  <button
    type="button"
    disabled={idle.length === 0}
    onClick={() => selectNextIdleArmy(idle)}
    aria-keyshortcuts="I"
    title={idle.length === 0 ? "No army waits at full stamina" : "Select the next idle army (I)"}
    className={cn(
      "pointer-events-auto flex h-9 items-center gap-1.5 rounded-full border border-kit-line2 bg-black/70 px-3 text-sm font-semibold text-kit-cream hover:border-kit-gold disabled:opacity-50",
      className,
    )}
  >
    <Icon name="military" size={18} />
    Idle {idle.length}
    <kbd className="hud-key">I</kbd>
  </button>
);
