import { Icon as SemanticIcon, type IconMeaning } from "@/ui/design-system/icon";
import { LeftView } from "@/types";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HUD_BODY_MUTED, HUD_LABEL } from "@/ui/design-system/atoms/hud-typography";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { getTierStyle } from "@/ui/utils/tier-styles";
import { currencyFormat } from "@/ui/utils/utils";
import { getTroopResourceId, StaminaManager } from "@bibliothecadao/eternum";
import { requireActiveGameClient } from "@/sync/active-game-client";
import { useExplorersByStructure } from "@/hooks/helpers/use-armies";
import { type ArmyInfo, type ID, resources, type TroopTier, type TroopType } from "@bibliothecadao/types";

import { memo, useMemo, useState } from "react";
import { useConfirmFor } from "@/hooks/helpers/use-confirm-for";

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
    <div className={cn("rounded-md border border-gold/25 bg-black/25 px-2.5 py-2", className)}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className={cn("flex items-center gap-1.5", HUD_LABEL, "text-gold/75")}>
          <SemanticIcon name="target" className="h-3 w-3 text-gold/65" />
          Existing armies
        </span>
        <span className={cn(HUD_LABEL, "text-gold/55")}>{ownedArmies.length}</span>
      </div>
      {ownedArmies.length === 0 ? (
        <p className={cn(HUD_BODY_MUTED, "text-[11px]")}>None deployed yet.</p>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-1.5 lg:max-h-[220px] overflow-y-auto pr-0.5 scrollbar-thin scrollbar-thumb-gold/20 scrollbar-track-transparent">
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
    <li className="flex items-center gap-2 rounded-md border border-gold/20 bg-black/30 px-2 py-1.5" title={army.name}>
      <span
        className={cn(
          "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold border leading-none",
          getTierStyle(army.troops?.tier as TroopTier),
        )}
      >
        {army.troops?.tier ?? "—"}
      </span>
      {troopResource !== null && (
        <ResourceIcon withTooltip={false} resource={troopResource} size="sm" className="shrink-0" />
      )}
      <span className="text-[12px] font-semibold tabular-nums text-gold">{currencyFormat(rawCount, 0)}</span>
      {maxStamina > 0 && stamina && (
        <div
          className="flex min-w-0 flex-1 items-center gap-1.5"
          title={`Stamina ${Number(stamina.amount)}/${maxStamina}`}
        >
          <span className="shrink-0 text-[10px] text-gold/65">Stamina</span>
          <div className="relative h-2 flex-1 min-w-0 overflow-hidden rounded-sm bg-black/40">
            {/* A neutral bar: low stamina is a state to read, not an alarm. */}
            <div className="absolute inset-y-0 left-0 bg-gold/60" style={{ width: `${staminaPercent}%` }} />
          </div>
          <span className="shrink-0 text-[10px] tabular-nums text-gold/65">
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
  gold: "border-gold/30 text-gold/80 hover:border-gold hover:text-gold",
  emerald: "border-emerald-400/40 text-emerald-300 hover:border-emerald-300 hover:text-emerald-200",
  rose: "border-rose-400/40 text-rose-300 hover:border-rose-300 hover:text-rose-200",
};

const IconButton = ({ icon: Icon, title, onClick, tone, disabled, spinning }: IconButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title}
    aria-label={title}
    className={cn(
      "inline-flex h-6 w-6 max-lg:h-11 max-lg:w-11 items-center justify-center rounded border bg-black/30 transition",
      TONE_CLASS[tone],
      disabled && "opacity-50 cursor-not-allowed",
    )}
  >
    <SemanticIcon name={Icon} className={cn("h-3.5 w-3.5", spinning && "animate-spin")} />
  </button>
);
