import { useBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { useGoToStructure } from "@/hooks/helpers/use-navigate";
import type { RealmAutomationConfig } from "@/hooks/store/use-automation-store";
import { useAutomationStore } from "@/hooks/store/use-automation-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { TRANSFER_POPUP_NAME } from "@/ui/features/economy/transfers/transfer-automation-popup";
import { ProductionModal } from "@/ui/features/settlement";
import { productionAutomation } from "@/ui/features/world/components/config";
import { ActiveRelicEffects } from "@/ui/features/world/components/entities/active-relic-effects";
import { CompactEntityInventory } from "@/ui/features/world/components/entities/compact-entity-inventory";
import { StructureProductionPanel } from "@/ui/features/world/components/entities/structure-production-panel";
import { buildVillageTimerSummary } from "@/ui/shared/lib/village-timers";
import { extractTransactionHash, waitForTransactionConfirmation } from "@/ui/utils/transactions";
import { inferRealmPreset } from "@/utils/automation-presets";
import { getRealmStatusColor, getRealmStatusLabel, getFailureSeverity, timeAgo } from "@/utils/automation-status";
import {
  Position,
  formatTime,
  getGuardsByStructure,
  getStructureArmyRelicEffects,
  getStructureRelicEffects,
} from "@bibliothecadao/eternum";
import { useDojo, useExplorersByStructure, useQuery } from "@bibliothecadao/react";
import {
  ClientComponents,
  ContractAddress,
  EntityType,
  RelicRecipientType,
  ResourcesIds,
  StructureType,
} from "@bibliothecadao/types";
import { useComponentValue } from "@dojoengine/react";
import { ComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import ArrowLeftRight from "lucide-react/dist/esm/icons/arrow-left-right";
import Bot from "lucide-react/dist/esm/icons/bot";
import Shield from "lucide-react/dist/esm/icons/shield";
import Sword from "lucide-react/dist/esm/icons/sword";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const ProductionStatusPill = ({ statusLabel }: { statusLabel: string }) => (
  <span className="rounded-full border border-gold/30 bg-black/40 px-2 py-0.5 text-[10px] uppercase tracking-wide text-gold/80">
    {statusLabel}
  </span>
);

const ProductionModifyButton = ({ onClick, disabled = false }: { onClick?: () => void; disabled?: boolean }) => (
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
    return "Smart automation";
  }

  const presetId = inferRealmPreset(automation);

  if (presetId === "idle") {
    return "Idle";
  }

  if (presetId === "smart") {
    return "Smart automation";
  }

  if (!automation.customPercentages || Object.keys(automation.customPercentages).length === 0) {
    return "Smart automation";
  }

  const hasLabor = Object.values(automation.customPercentages ?? {}).some(
    (config) => (config?.laborToResource ?? 0) > 0,
  );
  const hasResource = Object.values(automation.customPercentages ?? {}).some(
    (config) => (config?.resourceToResource ?? 0) > 0,
  );

  if (hasLabor && hasResource) return "Burning labor & resources";
  if (hasResource) return "Burning resources";
  if (hasLabor) return "Burning labor";

  return "Idle";
};

const NextAutomationRunLabel = memo(() => {
  const nextRunTimestamp = useAutomationStore((state) => state.nextRunTimestamp);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (typeof nextRunTimestamp !== "number") return;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [nextRunTimestamp]);

  if (typeof nextRunTimestamp !== "number") {
    return <span>Automation schedule pending.</span>;
  }

  const remainingSeconds = Math.max(0, Math.ceil((nextRunTimestamp - nowMs) / 1000));
  return <span>Next automation run in {remainingSeconds}s</span>;
});

NextAutomationRunLabel.displayName = "NextAutomationRunLabel";

const RealmAutomationStatusLine = memo(({ realmId }: { realmId: string }) => {
  const lastStatus = useAutomationStore(useCallback((state) => state.realms[realmId]?.lastStatus, [realmId]));
  const lastExecution = useAutomationStore(useCallback((state) => state.realms[realmId]?.lastExecution, [realmId]));

  if (!lastStatus) return null;

  const statusColor = getRealmStatusColor(lastStatus);
  const statusLabel = getRealmStatusLabel(lastStatus);
  const failureSeverity = getFailureSeverity(lastStatus);
  const timeSince = timeAgo(lastStatus.attemptedAt);

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <span
          className={`inline-block h-1.5 w-1.5 rounded-full ${
            lastStatus.status === "success"
              ? "bg-emerald-400"
              : lastStatus.status === "failed"
                ? "bg-red-400"
                : "bg-amber-400"
          }`}
        />
        <span className={`text-[10px] ${statusColor}`}>{statusLabel}</span>
        <span className="text-[10px] text-gold/30">{timeSince}</span>
      </div>

      {failureSeverity === "critical" && (
        <div className="rounded border border-danger/30 bg-danger/5 px-2 py-1 text-[10px] text-danger">
          {lastStatus.consecutiveFailures} consecutive failures: {lastStatus.message}
        </div>
      )}

      {lastStatus.status === "success" && lastExecution?.outputsByResource && (
        <div className="text-[10px] text-gold/40">
          Produced:{" "}
          {Object.entries(lastExecution.outputsByResource)
            .filter(([, amount]) => amount > 0)
            .map(([resId, amount]) => {
              const label = ResourcesIds[Number(resId) as ResourcesIds];
              return `${Math.round(amount).toLocaleString()} ${typeof label === "string" ? label : `#${resId}`}`;
            })
            .join(", ")}
        </div>
      )}
    </div>
  );
});

RealmAutomationStatusLine.displayName = "RealmAutomationStatusLine";

export const RealmInfoPanel = memo(({ className }: { className?: string }) => {
  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const toggleModal = useUIStore((state) => state.toggleModal);
  const openArmyCreationPopup = useUIStore((state) => state.openArmyCreationPopup);
  const openPopup = useUIStore((state) => state.openPopup);
  const togglePopup = useUIStore((state) => state.togglePopup);
  const isTransferPopupOpen = useUIStore((state) => state.isPopupOpen(TRANSFER_POPUP_NAME));
  const setTransferPanelSourceId = useUIStore((state) => state.setTransferPanelSourceId);
  const automationRealms = useAutomationStore((state) => state.realms);
  const hasAutomationFailures = useAutomationStore(
    useCallback((state) => Object.values(state.realms).some((r) => (r.lastStatus?.consecutiveFailures ?? 0) >= 3), []),
  );
  const { setup, account, network } = useDojo();
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
  const villageTroop = useComponentValue(
    components.VillageTroop,
    structureEntityId ? getEntityIdFromKeys([BigInt(structureEntityId)]) : undefined,
  ) as ComponentValue<ClientComponents["VillageTroop"]["schema"]> | null;

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

  const { currentArmiesTick, currentBlockTimestamp } = useBlockTimestamp();

  const relicEffects = useMemo(() => {
    if (!structure) return [];
    const structureRelicEffects = productionBoostBonus
      ? getStructureRelicEffects(productionBoostBonus, currentArmiesTick)
      : [];
    const armyRelicEffects = getStructureArmyRelicEffects(structure, currentArmiesTick);
    return [...structureRelicEffects, ...armyRelicEffects];
  }, [productionBoostBonus, structure, currentArmiesTick]);

  const activeRelicIds = useMemo(() => relicEffects.map((effect) => Number(effect.id)), [relicEffects]);

  const canShowBalanceOnly = (isHyperstructure || isFragmentMine) && isOwned;

  const explorers = useExplorersByStructure({
    structureEntityId: structureEntityId ?? 0,
  });

  const guards = useMemo(
    () => (structure ? getGuardsByStructure(structure).filter((guard) => guard.troops && guard.troops.count > 0n) : []),
    [structure],
  );

  const attackArmyCount = explorers.length;
  const guardArmyCount = guards.length;
  const maxAttackArmies =
    structure?.base?.troop_max_explorer_count !== undefined ? Number(structure.base.troop_max_explorer_count) : null;
  const maxGuardArmies =
    structure?.base?.troop_max_guard_count !== undefined ? Number(structure.base.troop_max_guard_count) : null;
  const shouldRenderVillageUi = isVillage;
  const isVillageMilitiaClaimed = Boolean(villageTroop?.claimed);
  const [isClaimingVillageMilitia, setIsClaimingVillageMilitia] = useState(false);

  const villageTimerSummary = useMemo(() => {
    if (!shouldRenderVillageUi || !structure || !currentBlockTimestamp) {
      return null;
    }

    return buildVillageTimerSummary({
      createdAtTimestamp: structure.base?.created_at,
      currentBlockTimestamp,
    });
  }, [currentBlockTimestamp, shouldRenderVillageUi, structure]);

  const isMilitiaClaimActionVisible = isVillage && isOwned;
  const isMilitiaClaimReady = (villageTimerSummary?.militiaUnlockRemainingSeconds ?? 1) <= 0;
  const canClaimVillageMilitia = isMilitiaClaimActionVisible && isMilitiaClaimReady && !isVillageMilitiaClaimed;
  const shouldRenderMilitiaClaimCard = isMilitiaClaimActionVisible;

  const handleClaimVillageMilitia = useCallback(async () => {
    if (!canClaimVillageMilitia || !structureEntityId) {
      return;
    }

    setIsClaimingVillageMilitia(true);
    try {
      const claimResult = await setup.systemCalls.receive_army_grant({
        signer: account.account,
        village_id: Number(structureEntityId),
      });

      const txHash = extractTransactionHash(claimResult);
      if (txHash) {
        await waitForTransactionConfirmation({
          txHash,
          provider: network.provider as { waitForTransactionWithCheck?: (hash: string) => Promise<unknown> },
          account: account.account as { waitForTransaction?: (hash: string) => Promise<unknown> },
          label: "village militia claim",
        });
      }

      toast.success("Village militia claimed.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to claim village militia.";
      toast.error(message);
    } finally {
      setIsClaimingVillageMilitia(false);
    }
  }, [account.account, canClaimVillageMilitia, network.provider, setup.systemCalls, structureEntityId]);

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
            <div className="flex items-center gap-1.5">
              <span className="text-xxs uppercase tracking-[0.2em] text-gold/60">Production</span>
              <button
                onClick={() => togglePopup(productionAutomation)}
                className="relative p-0.5 text-gold/50 hover:text-gold transition-colors"
                title="Automation Dashboard"
                type="button"
              >
                <Bot className="w-3.5 h-3.5" />
                {hasAutomationFailures && (
                  <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
                )}
              </button>
            </div>
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
                showProductionSummary={false}
                badgeVariant="detailed"
              />
            ) : (
              <p className="text-xxs text-gold/60 italic">Production data unavailable.</p>
            )}
          </div>
          <div className="mt-3 text-right text-[10px] text-gold/50">
            <NextAutomationRunLabel />
          </div>
          {realmId && (
            <div className="mt-1">
              <RealmAutomationStatusLine realmId={String(realmId)} />
            </div>
          )}
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
            maxItems={14}
            allowRelicActivation
            activeRelicIds={activeRelicIds}
          />
        </div>
      </div>

      {relicEffects.length > 0 && structureEntityId && (
        <ActiveRelicEffects relicEffects={relicEffects} entityId={structureEntityId} compact />
      )}

      {shouldRenderVillageUi && (
        <div className="rounded border border-gold/20 bg-black/50 p-2">
          <div className="text-xxs uppercase tracking-[0.2em] text-gold/60">Village Timers</div>
          {villageTimerSummary ? (
            <div className="mt-2 space-y-1 text-xxs text-gold/80">
              <div className="flex items-center justify-between gap-2 rounded border border-gold/10 bg-black/20 px-2 py-1">
                <span>Militia unlock</span>
                <span className="font-semibold text-gold">
                  {villageTimerSummary.militiaUnlockRemainingSeconds > 0
                    ? formatTime(villageTimerSummary.militiaUnlockRemainingSeconds)
                    : "Ready"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 rounded border border-gold/10 bg-black/20 px-2 py-1">
                <span>Settlement raid immunity</span>
                <span className="font-semibold text-gold">
                  {villageTimerSummary.settlementImmunityRemainingSeconds > 0
                    ? formatTime(villageTimerSummary.settlementImmunityRemainingSeconds)
                    : "Expired"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 rounded border border-gold/10 bg-black/20 px-2 py-1">
                <span>Post-raid resource immunity window</span>
                <span className="font-semibold text-gold">
                  {villageTimerSummary.postRaidImmunityWindowSeconds > 0
                    ? formatTime(villageTimerSummary.postRaidImmunityWindowSeconds)
                    : "Unavailable"}
                </span>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-xxs text-gold/60 italic">Village timer data unavailable.</p>
          )}
          {shouldRenderMilitiaClaimCard && (
            <div className="mt-2 rounded border border-gold/15 bg-black/20 p-2">
              <button
                type="button"
                onClick={() => {
                  void handleClaimVillageMilitia();
                }}
                disabled={!canClaimVillageMilitia || isClaimingVillageMilitia}
                className={cn(
                  "w-full rounded border px-2 py-1 text-xxs font-semibold uppercase tracking-[0.12em] transition",
                  canClaimVillageMilitia && !isClaimingVillageMilitia
                    ? "border-gold/70 bg-gold/15 text-gold hover:bg-gold/25"
                    : "cursor-not-allowed border-gold/25 bg-black/30 text-gold/50",
                )}
              >
                {isClaimingVillageMilitia
                  ? "Claiming Militia..."
                  : isVillageMilitiaClaimed
                    ? "Militia Claimed"
                    : canClaimVillageMilitia
                      ? "Claim Militia (Onchain)"
                      : "Militia Locked"}
              </button>
              {!isVillageMilitiaClaimed && !canClaimVillageMilitia && (
                <p className="mt-1 text-[10px] text-gold/65">Militia claim unlocks after the timer reaches ready.</p>
              )}
            </div>
          )}
        </div>
      )}

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
                  openArmyCreationPopup({
                    structureId: Number(structureEntityId),
                    isExplorer: true,
                  });
                }}
                disabled={!isOwned || !structureEntityId}
                aria-label="Create field army"
                title="Create field army"
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
                  openArmyCreationPopup({
                    structureId: Number(structureEntityId),
                    isExplorer: false,
                    maxDefenseSlots,
                  });
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
              <div className="text-xxs uppercase tracking-[0.12em] text-gold/60">Field Armies</div>
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
