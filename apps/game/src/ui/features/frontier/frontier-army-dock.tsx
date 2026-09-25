import { type OpenArmySlot, resolveExplorerTroops } from "@bibliothecadao/eternum/troop-stamina";
import { useGame } from "@/hooks/context/game-context";
import { useBlockTimestamp, useCurrentArmiesTick } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useNavigateToMapView } from "@/hooks/helpers/use-navigate";
import { useQuery } from "@/hooks/helpers/use-query";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { buildStaminaDisplayModel } from "@/lib/army-stamina/presentation";
import type { ArmyStaminaPresentation } from "@/lib/army-stamina/types";
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
  expeditionDepth,
  getArmyName,
  liveHomeArmies,
  Position,
} from "@bibliothecadao/eternum";
import type { NativeFactStore, NativeRows } from "@bibliothecadao/eternum/game-client";
import { useMemo } from "react";
import { Sweep } from "@/ui/motion/sweep";
import { formatAmount, formatClock } from "./frontier-format";
import { useExpeditionRules } from "./frontier-home";
import { describeSlotBar, useOpenArmySlots } from "./frontier-muster-stamina";
import { ArmyLevel } from "./attributes/army-level";
import { AttributeBadge } from "./attributes/attribute-badge";
import { PickChip } from "./attributes/pick-chip";
import { formatRevealYield, useRevealYield } from "./frontier-reveal-yield";
import { useMusterPointed } from "./guide/guide-pointer";

const ARMY_MODELS = [
  "ArmySlot",
  "ArmyProgress",
  "ArmyProgressionRules",
  "ExplorerTroops",
  "TileOccupancy",
  "EntityName",
] as const;

/**
 * One card per army slot the castle grants: today's armies with their strength and stamina, then a Muster card for
 * every open slot, saying whether its next army starts fresh or on the bar a lost army left. A row along the foot of a phone held upright; a column down the left edge otherwise.
 */
export const FrontierArmyDock = ({ realm }: { realm: NativeRows["Structure"] }) => {
  const { setup } = useGame();
  const revision = useNativeRevision(ARMY_MODELS);
  const tick = useCurrentArmiesTick();
  const armies = useMemo(
    () => liveHomeArmies(setup.store, realm.entity_id, configManager.getActiveGameId()),
    [realm.entity_id, revision, setup.store, tick],
  );
  const openSlots = useOpenArmySlots(realm);
  // Until every slot is known, the castle's allowance still says how many cards are open; their bars read "—".
  const openCards =
    openSlots ??
    Array.from({ length: Math.max(0, realm.base.troop_max_explorer_count - armies.length) }, () => undefined);

  return (
    <nav
      aria-label="Armies"
      className="pointer-events-auto flex gap-2 overflow-x-auto overscroll-contain landscape:flex-col landscape:overflow-y-auto landscape:overflow-x-hidden"
    >
      {armies.map((army, index) => (
        <ArmyCard key={army.explorer_id} army={army} position={index + 1} />
      ))}
      {openCards.map((slot, index) => (
        <MusterCard key={slot?.slot ?? `open-${index}`} slot={slot} />
      ))}
    </nav>
  );
};

const CARD = "flex w-44 shrink-0 flex-col gap-1 rounded-xl px-3 py-2 text-left landscape:w-48";

const ArmyCard = ({ army, position }: { army: NativeRows["ExplorerTroops"]; position: number }) => {
  const { setup } = useGame();
  const { isMapView } = useQuery();
  const navigateToMapView = useNavigateToMapView();
  const selected = useUIStore((state) => state.entityActions.selectedEntityId === army.explorer_id);
  const { currentArmiesTick, armiesTickTimeRemaining } = useBlockTimestamp();
  const limits = configManager.getTroopConfig().troop_limit_config;
  const snapshot = getExplorerStaminaSnapshot({
    entityId: army.explorer_id,
    currentArmiesTick,
    liveTroops: resolveExplorerTroops(setup.store, army),
  });
  const stamina = snapshot
    ? buildStaminaDisplayModel({
        committedCurrent: snapshot.current,
        committedMax: snapshot.max,
        armiesTickTimeRemaining,
        currentArmiesTick,
        troops: snapshot.troops,
      })
    : null;

  // The world map selects the army in place; from the realm board the first tap goes out to it.
  const pick = () => {
    if (isMapView) {
      requestArmySelection(army.explorer_id);
      return;
    }
    const coord = entityMapPosition(setup.store, configManager.getActiveGameId(), army.explorer_id);
    navigateToMapView(Position.fromContract(coord));
  };

  // Progress and its rules are required facts: until both arrive the card shows no level, badge or pick.
  const progress = setup.store.get("ArmyProgress", { game_id: army.game_id, explorer_id: army.explorer_id });
  const rules = setup.store.get("ArmyProgressionRules", { game_id: army.game_id });

  // The Pick chip is its own button, so it sits in the card's corner rather than inside the card's button; the dock
  // scrolls, so the corner stays inside the card's bounds.
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        aria-pressed={selected}
        onClick={pick}
        className={cn(OVERLAY_SURFACE_BASE, CARD, selected && OVERLAY_SURFACE_ACTIVE)}
      >
        <span
          className={cn(
            HUD_LABEL_BRIGHT,
            "truncate normal-case tracking-normal",
            progress?.pending && "min-h-7 pr-16 leading-7",
          )}
        >
          {dockArmyName(setup.store, army.explorer_id, position)}
        </span>
        <span className="flex items-baseline gap-1">
          <span className={cn(HUD_VALUE, "tabular-nums")}>{formatAmount(armyStrength(army.troops, limits))}</span>
          <span className={HUD_LABEL}>strength</span>
        </span>
        <StaminaBar stamina={stamina} />
        {progress && rules && <ArmyLevel progress={progress} rules={rules} />}
        {progress && <AttributeBadge progress={progress} />}
        <ArmyRevealYield army={army} />
      </button>
      {progress && rules && (
        <span className="absolute right-2 top-1.5">
          <PickChip progress={progress} rules={rules} />
        </span>
      )}
    </div>
  );
};

/** What this army's next reveal sends home at the depth it stands on. */
const ArmyRevealYield = ({ army }: { army: NativeRows["ExplorerTroops"] }) => {
  const { setup } = useGame();
  const rules = useExpeditionRules();
  const coord = entityMapPosition(setup.store, configManager.getActiveGameId(), army.explorer_id);
  const amount = useRevealYield(army.troops, rules ? expeditionDepth(rules, coord) : 0);
  if (amount === null) return null;
  return <span className={cn(HUD_LABEL, "tracking-normal")}>{formatRevealYield(amount)}</span>;
};

/**
 * Stamina as the chain grants it at this tick, and when the bar is full, counting down every second on chain time;
 * unknown shows as "—" and an empty bar.
 */
const StaminaBar = ({ stamina }: { stamina: ArmyStaminaPresentation | null }) => (
  <span className="flex flex-col gap-0.5" aria-label="Stamina">
    <span className="h-1.5 overflow-hidden rounded-full bg-black/50">
      <span
        className="block h-full rounded-full bg-emerald-400/80"
        style={{ width: `${(stamina?.committedRatio ?? 0) * 100}%` }}
      />
    </span>
    <span className={cn(HUD_LABEL, "flex justify-between gap-2 tabular-nums tracking-normal")}>
      <span>{stamina ? `${stamina.committedCurrent}/${stamina.committedMax}` : "—"}</span>
      {stamina && <span className="whitespace-nowrap">{describeFull(stamina)}</span>}
    </span>
  </span>
);

const describeFull = (stamina: ArmyStaminaPresentation): string =>
  stamina.secondsUntilFull > 0 ? `full in ${formatClock(stamina.secondsUntilFull)}` : "rested";

/** The army's own name when it has one; otherwise its place in the dock, never its entity id. */
const dockArmyName = (store: NativeFactStore, explorerId: number, position: number): string => {
  const named = store.get("EntityName", { game_id: configManager.getActiveGameId(), entity_id: explorerId });
  return named && named.name !== 0n ? getArmyName(explorerId, store) : `Army ${position}`;
};

const MusterCard = ({ slot }: { slot: OpenArmySlot | undefined }) => {
  const setLeftNavigationView = useUIStore((state) => state.setLeftNavigationView);
  const pointed = useMusterPointed();
  return (
    <Sweep play={pointed} className="shrink-0 rounded-xl">
      <button
        type="button"
        onClick={() => setLeftNavigationView(LeftView.MilitaryView)}
        className={cn(OVERLAY_SURFACE_BASE, CARD, "h-full items-center justify-center border-dashed")}
      >
        <span className={HUD_LABEL_BRIGHT}>Muster</span>
        <span className={HUD_LABEL}>Open slot · {describeSlotBar(slot)}</span>
      </button>
    </Sweep>
  );
};
