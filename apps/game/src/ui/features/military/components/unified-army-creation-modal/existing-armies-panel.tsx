import { Icon as SemanticIcon, type IconMeaning } from "@/ui/design-system/icon";
import { LeftView } from "@/types";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { currencyFormat } from "@/ui/utils/utils";
import { getTroopResourceId, StaminaManager } from "@bibliothecadao/eternum";
import { requireActiveGameClient } from "@/sync/active-game-client";
import { useExplorersByStructure } from "@/hooks/helpers/use-armies";
import { type ArmyInfo, type ID, type TroopTier, type TroopType } from "@bibliothecadao/types";

import { memo, useMemo, useState } from "react";
import { useConfirmFor } from "@/hooks/helpers/use-confirm-for";
import { TierChip } from "../../utils/tier-chip";

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
        <span className={cn("flex items-center gap-1.5", "text-hud-label text-hud-muted", "text-hud-muted")}>
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
  const selectOnMap = useUIStore((state) => state.selectOnMap);
  const setLeftNavigationView = useUIStore((state) => state.setLeftNavigationView);
  const timestamp = useCurrentDefaultTick();
  const { confirming, ask, close } = useConfirmFor(army.entityId);
  const [deleting, setDeleting] = useState(false);

  // troops.count is the raw precision value; currencyFormat divides internally.
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

  const handleJump = () => {
    selectOnMap({ kind: "hex", hex: { col: Number(army.position.x), row: Number(army.position.y) } });
    setLeftNavigationView(LeftView.None);
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
      console.error("Failed to delete army", error);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <li className="flex items-center gap-2 rounded-md border border-hud-line bg-hud-well px-2 py-1.5" title={army.name}>
      <TierChip tier={army.troops?.tier} />
      {troopResource !== null && (
        <ResourceIcon withTooltip={false} resource={troopResource} size="sm" className="shrink-0" />
      )}
      <span className="text-hud-label tabular-nums text-hud-accent">{currencyFormat(rawCount, 0)}</span>
      {maxStamina > 0 && stamina && (
        <div
          className="flex min-w-0 flex-1 items-center gap-1.5"
          title={`Stamina ${Number(stamina.amount)}/${maxStamina}`}
        >
          <span className="shrink-0 text-hud-label text-hud-muted">Stamina</span>
          <div className="relative h-2 flex-1 min-w-0 overflow-hidden rounded-sm bg-hud-well">
            {/* A neutral bar: low stamina is a state to read, not an alarm. */}
            <div className="absolute inset-y-0 left-0 bg-hud-gold" style={{ width: `${staminaPercent}%` }} />
          </div>
          <span className="shrink-0 text-hud-label tabular-nums text-hud-muted">
            {Number(stamina.amount)}/{maxStamina}
          </span>
        </div>
      )}
      <div className="flex shrink-0 items-center gap-0.5">
        {!confirming && <IconButton icon={"map" as const} title="Navigate to army" onClick={handleJump} tone="gold" />}
        {!confirming ? (
          <IconButton icon={"trash" as const} title="Disband army" onClick={ask} tone="rose" />
        ) : (
          <>
            <IconButton
              icon={deleting ? ("refresh" as const) : ("check" as const)}
              title="Confirm disband"
              onClick={handleConfirmDelete}
              tone="emerald"
              spinning={deleting}
            />
            <IconButton icon={"close" as const} title="Cancel" onClick={close} tone="rose" disabled={deleting} />
          </>
        )}
      </div>
    </li>
  );
};

type IconButtonProps = {
  icon: IconMeaning;
  title: string;
  onClick: () => void;
  tone: "gold" | "emerald" | "rose";
  disabled?: boolean;
  spinning?: boolean;
};

const TONE_CLASS: Record<IconButtonProps["tone"], string> = {
  gold: "border-hud-line text-hud-accent hover:border-hud-line-strong hover:text-hud-accent",
  emerald: "border-hud-good text-hud-good hover:border-hud-good hover:text-hud-good",
  rose: "border-hud-bad text-hud-bad hover:border-hud-bad hover:text-hud-bad",
};

const IconButton = ({ icon: Icon, title, onClick, tone, disabled, spinning }: IconButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title}
    aria-label={title}
    className={cn(
      "inline-flex h-6 w-6 max-lg:h-11 max-lg:w-11 items-center justify-center rounded border bg-hud-well transition",
      TONE_CLASS[tone],
      disabled && "opacity-50 cursor-not-allowed",
    )}
  >
    <SemanticIcon name={Icon} className={cn("h-3.5 w-3.5", spinning && "animate-spin")} />
  </button>
);
