import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { LeftView } from "@/types";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { knownAmount } from "@/ui/utils/utils";
import { getTroopResourceId, StaminaManager } from "@bibliothecadao/eternum";
import { requireActiveGameClient } from "@/sync/active-game-client";
import { useExplorersByStructure } from "@/hooks/helpers/use-armies";
import { useSelectArmyOnMap } from "@/hooks/helpers/use-navigate";
import { type ArmyInfo, type ID, type TroopTier, type TroopType, formatAmount } from "@bibliothecadao/types";

import { memo, useMemo, useState } from "react";
import { useConfirmFor, useConfirmsLoss } from "@/hooks/helpers/use-confirm-for";
import { HudConfirm, HudIconButton, HudMeter } from "@/ui/design-system/kit/hud-elements";
import { TierChip } from "../../utils/tier-chip";
import { toast } from "@/ui/features/event-feed/notify";

interface ExistingArmiesPanelProps {
  structureId: ID;
  className?: string;
}

/**
 * Compact list of existing field armies anchored to a structure. Sits as its
 * own panel under the deploy body in the Military modal so the player can
 * scan all their armies at a glance and jump to / disband any of them.
 */
export const ExistingArmiesPanel = memo(({ structureId, className }: ExistingArmiesPanelProps) => {
  const armies = useExplorersByStructure({ structureEntityId: structureId });
  const ownedArmies = useMemo(() => armies.filter((army) => army.isMine), [armies]);

  return (
    <div className={cn("rounded-md border border-hud-line bg-hud-well px-2.5 py-2", className)}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-hud-label text-hud-muted">
          <SemanticIcon name="target" className="h-3 w-3 text-hud-muted" />
          Existing armies
        </span>
        <span className="text-hud-label text-hud-cue">{ownedArmies.length}</span>
      </div>
      {ownedArmies.length === 0 ? (
        <p className="text-hud-label text-hud-cue">None deployed yet.</p>
      ) : (
        <ul className="grid gap-1.5 overflow-y-auto pr-0.5 sm:grid-cols-2 lg:max-h-56">
          {ownedArmies.map((army) => (
            <ExistingArmyRow key={army.entityId} army={army} structureId={structureId} />
          ))}
        </ul>
      )}
    </div>
  );
});

ExistingArmiesPanel.displayName = "ExistingArmiesPanel";

const ExistingArmyRow = ({ army, structureId }: { army: ArmyInfo; structureId: ID }) => {
  const selectArmy = useSelectArmyOnMap();
  const setLeftNavigationView = useUIStore((state) => state.setLeftNavigationView);
  const timestamp = useCurrentDefaultTick();
  const { confirming, ask, close } = useConfirmFor(army.entityId);
  const [deleting, setDeleting] = useState(false);
  const confirmsDisband = useConfirmsLoss();

  // troops.count is the raw precision value; knownAmount divides it.
  const rawCount = Number(army.troops?.count ?? 0);

  const stamina = useMemo(() => {
    if (!army.troops) return null;
    return StaminaManager.getStamina(army.troops, timestamp);
  }, [army.troops, timestamp]);

  const maxStamina = useMemo(() => {
    if (!army.troops) return 0;
    return StaminaManager.getMaxStamina(
      army.troops.category as TroopType,
      army.troops.tier as TroopTier,
      army.troops.staminaMax,
    );
  }, [army.troops]);

  const staminaPercent = stamina && maxStamina > 0 ? Math.min(100, (Number(stamina.amount) / maxStamina) * 100) : 0;

  const troopResource = useMemo(
    () => (army.troops ? getTroopResourceId(army.troops.category as TroopType, army.troops.tier as TroopTier) : null),
    [army.troops],
  );

  // The sheet closes and the map frames and selects the army, as every "go to this army" does.
  const handleJump = () => {
    setLeftNavigationView(LeftView.None);
    selectArmy(army.entityId);
  };

  const bumpMilitaryMapVersion = useUIStore((state) => state.bumpMilitaryMapVersion);

  const handleConfirmDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await requireActiveGameClient().actions.deleteExplorerArmy({ structureId, explorerId: army.entityId });
      // Free the hex on the deploy map.
      bumpMilitaryMapVersion();
      close();
    } catch (error) {
      toast.failed(error, "The army could not be deleted.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <li
      className="flex flex-wrap items-center gap-2 rounded-md border border-hud-line bg-hud-well px-2 py-1.5"
      title={army.name}
    >
      <TierChip tier={army.troops?.tier} />
      {troopResource !== null && (
        <ResourceIcon withTooltip={false} resource={troopResource} size="sm" className="shrink-0" />
      )}
      <span className="text-hud-label tabular-nums text-hud-accent">{formatAmount(knownAmount(rawCount))}</span>
      {maxStamina > 0 && stamina && (
        <div
          className="flex min-w-0 flex-1 items-center gap-1.5"
          title={`Stamina ${Number(stamina.amount)}/${maxStamina}`}
        >
          <span className="shrink-0 text-hud-label text-hud-muted">Stamina</span>
          {/* A neutral bar: low stamina is a state to read, not an alarm. */}
          <span className="min-w-0 flex-1">
            <HudMeter share={staminaPercent / 100} label="Stamina" />
          </span>
          <span className="shrink-0 text-hud-label tabular-nums text-hud-muted">
            {Number(stamina.amount)}/{maxStamina}
          </span>
        </div>
      )}
      <div className="flex shrink-0 items-center gap-0.5">
        <HudIconButton icon="map" label="Navigate to army" kind="quiet" onClick={handleJump} />
        <HudIconButton
          icon="trash"
          label="Disband army"
          kind="quiet"
          disabled={deleting}
          onClick={confirmsDisband ? ask : handleConfirmDelete}
        />
      </div>
      {confirming && (
        <div className="basis-full">
          <HudConfirm
            question="Disband this army?"
            verb={deleting ? "Disbanding…" : "Disband"}
            tone="bad"
            onConfirm={handleConfirmDelete}
            onBack={close}
          >
            <span className="text-hud-body text-hud-muted">Its troops are lost.</span>
          </HudConfirm>
        </div>
      )}
    </li>
  );
};
