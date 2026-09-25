import { useGame } from "@/hooks/context/game-context";
import { useCurrentArmiesTick } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useNavigateToMapView } from "@/hooks/helpers/use-navigate";
import { useQuery } from "@/hooks/helpers/use-query";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { getExplorerStaminaSnapshot } from "@/utils/explorer-stamina";
import { requestArmySelection } from "@/three/scenes/worldmap-army-select-request";
import { LeftView } from "@/types";
import { HUD_LABEL, HUD_LABEL_BRIGHT, HUD_VALUE } from "@/ui/design-system/atoms/hud-typography";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { OVERLAY_SURFACE_ACTIVE, OVERLAY_SURFACE_BASE } from "@/ui/design-system/atoms/overlay-surface";
import {
  armyStrength,
  configManager,
  entityMapPosition,
  getArmyName,
  liveHomeArmies,
  Position,
} from "@bibliothecadao/eternum";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { useMemo } from "react";
import { formatAmount } from "./frontier-format";

const ARMY_MODELS = ["ExplorerTroops", "TileOccupancy", "EntityName"] as const;

/**
 * One card per army slot the castle grants: today's armies with their strength and stamina, then a Muster card for
 * every open slot. A row along the foot of a phone held upright; a column down the left edge otherwise.
 */
export const FrontierArmyDock = ({ realm }: { realm: NativeRows["Structure"] }) => {
  const { setup } = useGame();
  const revision = useNativeRevision(ARMY_MODELS);
  const tick = useCurrentArmiesTick();
  const armies = useMemo(
    () => liveHomeArmies(setup.store, realm.entity_id, configManager.getActiveGameId()),
    [realm.entity_id, revision, setup.store, tick],
  );
  const openSlots = Math.max(0, realm.base.troop_max_explorer_count - armies.length);

  return (
    <nav
      aria-label="Armies"
      className="pointer-events-auto flex gap-2 overflow-x-auto overscroll-contain landscape:flex-col landscape:overflow-y-auto landscape:overflow-x-hidden"
    >
      {armies.map((army) => (
        <ArmyCard key={army.explorer_id} army={army} />
      ))}
      {Array.from({ length: openSlots }, (_, index) => (
        <MusterCard key={`open-${index}`} />
      ))}
    </nav>
  );
};

const CARD = "flex w-40 shrink-0 flex-col gap-1 rounded-xl px-3 py-2 text-left font-sans landscape:w-44";

const ArmyCard = ({ army }: { army: NativeRows["ExplorerTroops"] }) => {
  const { setup } = useGame();
  const { isMapView } = useQuery();
  const navigateToMapView = useNavigateToMapView();
  const selected = useUIStore((state) => state.entityActions.selectedEntityId === army.explorer_id);
  const currentArmiesTick = useCurrentArmiesTick();
  const damage = configManager.getTroopConfig().troop_damage_config;
  const stamina = getExplorerStaminaSnapshot({
    entityId: army.explorer_id,
    currentArmiesTick,
    liveTroops: army.troops,
  });

  // The world map selects the army in place; from the realm board the first tap goes out to it.
  const pick = () => {
    if (isMapView) {
      requestArmySelection(army.explorer_id);
      return;
    }
    const coord = entityMapPosition(setup.store, configManager.getActiveGameId(), army.explorer_id);
    navigateToMapView(Position.fromContract(coord));
  };

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={pick}
      className={cn(OVERLAY_SURFACE_BASE, CARD, selected && OVERLAY_SURFACE_ACTIVE)}
    >
      <span className={cn(HUD_LABEL_BRIGHT, "truncate normal-case tracking-normal")}>
        {getArmyName(army.explorer_id, setup.store)}
      </span>
      <span className="flex items-baseline gap-1">
        <span className={cn(HUD_VALUE, "tabular-nums")}>{formatAmount(armyStrength(army.troops, damage))}</span>
        <span className={HUD_LABEL}>strength</span>
      </span>
      <StaminaBar current={stamina?.current} max={stamina?.max} />
    </button>
  );
};

/** Stamina as the chain grants it at this tick; unknown shows as "—" and an empty bar. */
const StaminaBar = ({ current, max }: { current: number | undefined; max: number | undefined }) => {
  const known = current !== undefined && max !== undefined && max > 0;
  const ratio = known ? Math.min(1, current / max) : 0;
  return (
    <span className="flex flex-col gap-0.5" aria-label="Stamina">
      <span className="h-1.5 overflow-hidden rounded-full bg-black/50">
        <span className="block h-full rounded-full bg-emerald-400/80" style={{ width: `${ratio * 100}%` }} />
      </span>
      <span className={cn(HUD_LABEL, "tabular-nums tracking-normal")}>{known ? `${current}/${max}` : "—"}</span>
    </span>
  );
};

const MusterCard = () => {
  const setLeftNavigationView = useUIStore((state) => state.setLeftNavigationView);
  return (
    <button
      type="button"
      onClick={() => setLeftNavigationView(LeftView.MilitaryView)}
      className={cn(OVERLAY_SURFACE_BASE, CARD, "items-center justify-center border-dashed")}
    >
      <span className={HUD_LABEL_BRIGHT}>Muster</span>
      <span className={HUD_LABEL}>Open slot</span>
    </button>
  );
};
