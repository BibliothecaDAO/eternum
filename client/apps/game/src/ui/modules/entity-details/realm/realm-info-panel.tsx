import { useUIStore } from "@/hooks/store/use-ui-store";
import { useAutomationStore } from "@/hooks/store/use-automation-store";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { CompactEntityInventory } from "@/ui/features/world/components/entities/compact-entity-inventory";
import { ProductionModal } from "@/ui/features/settlement";
import { useGoToStructure } from "@/hooks/helpers/use-navigate";
import {
  Position,
  getStructureArmyRelicEffects,
  getStructureRelicEffects,
  getBlockTimestamp,
  getGuardsByStructure,
} from "@bibliothecadao/eternum";
import { useDojo, useExplorersByStructure, useQuery } from "@bibliothecadao/react";
import { ClientComponents, ContractAddress, EntityType, RelicRecipientType, StructureType } from "@bibliothecadao/types";
import { useComponentValue } from "@dojoengine/react";
import { ComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { memo, useCallback, useMemo } from "react";
import { TRANSFER_POPUP_NAME } from "@/ui/features/economy/transfers/transfer-automation-popup";
import { ArrowLeftRight, Shield, Sword } from "lucide-react";
import { StructureProductionPanel } from "@/ui/features/world/components/entities/structure-production-panel";
import { inferRealmPreset } from "@/utils/automation-presets";
import type { RealmAutomationConfig } from "@/hooks/store/use-automation-store";
import { UnifiedArmyCreationModal } from "@/ui/features/military/components/unified-army-creation-modal";

const ProductionStatusPill = ({ statusLabel }: { statusLabel: string }) => (
  <span className="rounded-full border border-gold/30 bg-black/40 px-2 py-0.5 text-[10px] uppercase tracking-wide text-gold/80">
    {statusLabel}
  </span>
);

const ProductionModifyButton = ({
  onClick,
  disabled = false,
}: {
  onClick?: () => void;
  disabled?: boolean;
}) => (
  <button
    type="button"
    disabled={disabled}
    className={`rounded border border-gold bg-gold px-2 py-0.5 text-[10px] uppercase tracking-wide text-black font-semibold transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-gold ${
      disabled ? "opacity-60 cursor-not-allowed" : "hover:bg-[#ffd84a] hover:border-gold"
    }`}
    onClick={onClick}
  >
    Modify
  </button>
);

const resolveAutomationStatusLabel = (automation?: RealmAutomationConfig | null): string => {
  if (!automation) {
    return "Burning labor";
  }

  const presetId = inferRealmPreset(automation);

  if (presetId === "idle") {
    return "Idle";
  }

  if (presetId === "labor") {
    return "Burning labor";
  }

  if (presetId === "resource") {
    return "Burning resources";
  }

  const hasLabor = Object.values(automation.resources ?? {}).some(
    (config) => (config?.percentages?.laborToResource ?? 0) > 0,
  );
  const hasResource = Object.values(automation.resources ?? {}).some(
    (config) => (config?.percentages?.resourceToResource ?? 0) > 0,
  );

  if (hasLabor && hasResource) return "Burning labor & resources";
  if (hasResource) return "Burning resources";
  if (hasLabor) return "Burning labor";

  return "Idle";
};

const formatRelative = (timestamp?: number) => {
  if (!timestamp) return null;
  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
};

export const RealmInfoPanel = memo(({ className }: { className?: string }) => {
  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const toggleModal = useUIStore((state) => state.toggleModal);
  const openPopup = useUIStore((state) => state.openPopup);
  const isTransferPopupOpen = useUIStore((state) => state.isPopupOpen(TRANSFER_POPUP_NAME));
  const setTransferPanelSourceId = useUIStore((state) => state.setTransferPanelSourceId);
  const automationRealms = useAutomationStore((state) => state.realms);
  const { setup, account } = useDojo();
  const components = setup.components as ClientComponents;
  const { isMapView } = useQuery();
  const goToStructure = useGoToStructure(setup);

  const structure = useComponentValue(
    components.Structure,
    structureEntityId ? getEntityIdFromKeys([BigInt(structureEntityId)]) : undefined,
  ) as ComponentValue<ClientComponents["Structure"]["schema"]> | null;

  const resources = useComponentValue(
    components.Resource,
    structureEntityId ? getEntityIdFromKeys([BigInt(structureEntityId)]) : undefined,
  ) as ComponentValue<ClientComponents["Resource"]["schema"]> | null;

  const isRealm = structure?.base?.category === StructureType.Realm;
  const isVillage = structure?.base?.category === StructureType.Village;
  const isHyperstructure = structure?.base?.category === StructureType.Hyperstructure;
  const isFragmentMine = structure?.base?.category === StructureType.FragmentMine;
  const isOwned = structure ? structure.owner === ContractAddress(account.account.address) : false;

  const realmId = useMemo(() => {
    if (!structureEntityId) return null;
    const numericId = Number(structureEntityId);
    return Number.isFinite(numericId) ? numericId : null;
  }, [structureEntityId]);

  const structurePosition = useMemo(() => {
    const x = structure?.base?.coord_x;
    const y = structure?.base?.coord_y;
    if (x === undefined || y === undefined) return null;
    const numericX = Number(x);
    const numericY = Number(y);
    return Number.isFinite(numericX) && Number.isFinite(numericY) ? { x: numericX, y: numericY } : null;
  }, [structure]);

  const automationConfig = useMemo(() => {
    if (!realmId) return null;
    return automationRealms[String(realmId)];
  }, [automationRealms, realmId]);
  const statusLabel = resolveAutomationStatusLabel(automationConfig);
  const formattedLastRun = automationConfig?.lastExecution?.executedAt
    ? formatRelative(automationConfig.lastExecution.executedAt)
    : null;
  const lastRunLabel = formattedLastRun ? `Last run ${formattedLastRun}` : "Automation has not executed yet.";

  const handleModifyClick = useCallback(() => {
    if (!realmId || !structurePosition) return;
    const position = new Position({ x: structurePosition.x, y: structurePosition.y });
    void goToStructure(realmId, position, isMapView);
    toggleModal(<ProductionModal />);
  }, [realmId, structurePosition, goToStructure, isMapView, toggleModal]);

  const handleOpenTransfer = useCallback(() => {
    if (!structureEntityId) return;
    setTransferPanelSourceId(structureEntityId);
    if (!isTransferPopupOpen) {
      openPopup(TRANSFER_POPUP_NAME);
    }
  }, [isTransferPopupOpen, openPopup, setTransferPanelSourceId, structureEntityId]);

  const productionBoostBonus = useComponentValue(
    components.ProductionBoostBonus,
    structureEntityId ? getEntityIdFromKeys([BigInt(structureEntityId)]) : undefined,
  );

  const activeRelicIds = useMemo(() => {
    if (!structure) return [];
    const { currentArmiesTick } = getBlockTimestamp();
    const structureRelicEffects = productionBoostBonus
      ? getStructureRelicEffects(productionBoostBonus, currentArmiesTick)
      : [];
    const armyRelicEffects = getStructureArmyRelicEffects(structure, currentArmiesTick);
    return [...structureRelicEffects, ...armyRelicEffects].map((effect) => Number(effect.id));
  }, [productionBoostBonus, structure]);

  const canShowBalanceOnly = (isHyperstructure || isFragmentMine) && isOwned;

  const explorers = useExplorersByStructure({
    structureEntityId: structureEntityId ?? 0,
  });

  const guards = useMemo(
    () =>
      structure
        ? getGuardsByStructure(structure).filter((guard) => guard.troops && guard.troops.count > 0n)
        : [],
    [structure],
  );

  const attackArmyCount = explorers.length;
  const guardArmyCount = guards.length;
  const maxAttackArmies =
    structure?.base?.troop_max_explorer_count !== undefined
      ? Number(structure.base.troop_max_explorer_count)
      : null;
  const maxGuardArmies =
    structure?.base?.troop_max_guard_count !== undefined ? Number(structure.base.troop_max_guard_count) : null;

  if (!structure || (!isRealm && !isVillage && !canShowBalanceOnly)) {
    return (
      <div className={cn("p-3 text-xxs text-gold/70", className)}>
        Select a realm from the left panel to view production and balance.
      </div>
    );
  }

  return (
    <div className={cn("flex h-full flex-col gap-3 p-3 text-gold", className)}>
      {(isRealm || isVillage) && (
        <div className="rounded border border-gold/20 bg-black/50 p-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xxs uppercase tracking-[0.2em] text-gold/60">Production</span>
            <div className="flex items-center gap-2">
              <ProductionStatusPill statusLabel={statusLabel} />
              <ProductionModifyButton onClick={handleModifyClick} disabled={!realmId || !structurePosition} />
            </div>
          </div>
          <div className="mt-2">
            {structure && resources ? (
              <StructureProductionPanel
                structure={structure}
                resources={resources}
                compact
                smallTextClass="text-xxs"
                showTooltip={false}
              />
            ) : (
              <p className="text-xxs text-gold/60 italic">Production data unavailable.</p>
            )}
          </div>
          <div className="mt-3 text-right text-[10px] text-gold/50">{lastRunLabel}</div>
        </div>
      )}

      <div className="rounded border border-gold/20 bg-black/50 p-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xxs uppercase tracking-[0.2em] text-gold/60">Balance</span>
          <button
            type="button"
            onClick={handleOpenTransfer}
            disabled={!structureEntityId}
            className={cn(
              "flex items-center gap-1 rounded-full border border-gold/30 bg-black/40 px-2.5 py-1 text-xxs font-semibold text-gold/80 transition",
              !structureEntityId && "cursor-not-allowed opacity-50",
              structureEntityId && "hover:bg-gold/10 hover:text-gold",
            )}
            aria-label="Open transfer panel"
            title="Open transfer panel"
          >
            <ArrowLeftRight className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-2">
          <CompactEntityInventory
            resources={resources}
            recipientType={RelicRecipientType.Structure}
            entityId={structureEntityId ?? undefined}
            entityType={EntityType.STRUCTURE}
            variant="tight"
            showLabels={false}
            maxItems={12}
            allowRelicActivation
            activeRelicIds={activeRelicIds}
          />
        </div>
      </div>

      {(isRealm || isVillage) && (
        <div className="rounded border border-gold/20 bg-black/50 p-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xxs uppercase tracking-[0.2em] text-gold/60">Armies</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={cn(
                  "rounded-full border border-gold/30 bg-black/40 px-2.5 py-1 text-xxs font-semibold text-gold/80 transition",
                  (!isOwned || !structureEntityId) && "cursor-not-allowed opacity-50",
                  isOwned &&
                    structureEntityId &&
                    "hover:bg-gold/10 hover:text-gold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold",
                )}
                onClick={() => {
                  if (!structureEntityId || !isOwned) return;
                  toggleModal(<UnifiedArmyCreationModal structureId={Number(structureEntityId)} isExplorer />);
                }}
                disabled={!isOwned || !structureEntityId}
                aria-label="Create attack army"
                title="Create attack army"
              >
                <Sword className="h-4 w-4" />
              </button>
              <button
                type="button"
                className={cn(
                  "rounded-full border border-gold/30 bg-black/40 px-2.5 py-1 text-xxs font-semibold text-gold/80 transition",
                  (!isOwned || !structureEntityId) && "cursor-not-allowed opacity-50",
                  isOwned &&
                    structureEntityId &&
                    "hover:bg-gold/10 hover:text-gold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold",
                )}
                onClick={() => {
                  if (!structureEntityId || !isOwned) return;
                  const maxDefenseSlots = Number(structure?.base?.troop_max_guard_count ?? 0);
                  toggleModal(
                    <UnifiedArmyCreationModal
                      structureId={Number(structureEntityId)}
                      isExplorer={false}
                      maxDefenseSlots={maxDefenseSlots}
                    />,
                  );
                }}
                disabled={!isOwned || !structureEntityId}
                aria-label="Create defense army"
                title="Create defense army"
              >
                <Shield className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="rounded border border-gold/10 bg-[#1b140f]/80 p-2">
              <div className="text-xxs uppercase tracking-[0.12em] text-gold/60">Attack Armies</div>
              <div className="mt-1 text-sm font-semibold text-gold">
                {attackArmyCount}
                {maxAttackArmies !== null ? ` / ${maxAttackArmies}` : ""}
              </div>
            </div>
            <div className="rounded border border-gold/10 bg-[#1b140f]/80 p-2">
              <div className="text-xxs uppercase tracking-[0.12em] text-gold/60">Guard Armies</div>
              <div className="mt-1 text-sm font-semibold text-gold">
                {guardArmyCount}
                {maxGuardArmies !== null ? ` / ${maxGuardArmies}` : ""}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

RealmInfoPanel.displayName = "RealmInfoPanel";
