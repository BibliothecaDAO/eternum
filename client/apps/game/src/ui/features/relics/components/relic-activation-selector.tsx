import { useMemo, useState } from "react";

import { useUIStore } from "@/hooks/store/use-ui-store";
import Button from "@/ui/design-system/atoms/button";
import { BasePopup } from "@/ui/design-system/molecules/base-popup";
import { currencyFormat } from "@/ui/utils/utils";
import { getEntityInfo, getIsBlitz, getStructureName } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { ContractAddress, EntityType, ID, RelicRecipientType, Troops } from "@bibliothecadao/types";

import { TroopChip } from "@/ui/features/military/components/troop-chip";
import { isRelicCompatible, useRelicEssenceStatus, useRelicMetadata } from "../hooks/use-relic-activation";
import type { RelicHolderPreview } from "./player-relic-tray";
import { RelicEssenceRequirement, RelicIncompatibilityNotice, RelicSummary } from "./relic-activation-shared";

const ZERO_CONTRACT_ADDRESS = ContractAddress("0x0");

interface RelicActivationSelectorProps {
  resourceId: ID;
  displayAmount: string;
  holders: RelicHolderPreview[];
  onClose: () => void;
}

interface EnrichedHolder extends RelicHolderPreview {
  entityOwnerId: ID;
  entityName: string;
  parentStructureId: number | null;
  parentStructureName: string | null;
  troops: Troops | null;
}

type RelicInfoType = ReturnType<typeof useRelicMetadata>["relicInfo"];

interface ActivationRequest {
  holder: EnrichedHolder;
  hasEnoughEssence: boolean;
  essenceBalance: number;
}

type RelicActivationHolderCardProps = {
  holder: EnrichedHolder;
  relicInfo: RelicInfoType;
  essenceCost: number;
  onActivate: (request: ActivationRequest) => void;
  isActivating: boolean;
  activationError?: string | null;
};

const RelicActivationHolderCard = ({
  holder,
  relicInfo,
  essenceCost,
  onActivate,
  isActivating,
  activationError,
}: RelicActivationHolderCardProps) => {
  const { essenceBalance, hasEnoughEssence, missingEssence } = useRelicEssenceStatus(holder.entityOwnerId, essenceCost);
  const compatible = isRelicCompatible(relicInfo, holder.recipientType);
  const isArmyHolder = holder.entityType === EntityType.ARMY || holder.recipientType === RelicRecipientType.Explorer;
  const parentRealmLabel = (() => {
    if (holder.parentStructureName) {
      const suffix = holder.parentStructureId != null ? ` (#${holder.parentStructureId})` : "";
      return `${holder.parentStructureName}${suffix}`;
    }

    if (holder.parentStructureId != null) {
      return `Realm #${holder.parentStructureId}`;
    }

    return null;
  })();

  return (
    <div className="rounded border border-gold/20 bg-dark-brown/30 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gold">{holder.entityName}</p>
          <p className="text-xs text-gold/60">ID: {holder.entityId}</p>
        </div>
        <div className="text-xs font-semibold text-gold/70">Amount: {currencyFormat(holder.amount, 0)}</div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.2em] font-semibold">
        <span
          className={`rounded px-2 py-1 ${
            compatible ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"
          }`}
        >
          {compatible ? "Compatible" : "Incompatible"}
        </span>
        <span
          className={`rounded px-2 py-1 ${
            hasEnoughEssence ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"
          }`}
        >
          {hasEnoughEssence ? "Enough essence" : "Need essence"}
        </span>
      </div>

      {isArmyHolder && parentRealmLabel && (
        <div className="mt-2 w-full text-xxs text-gold/60">Parent Realm · {parentRealmLabel}</div>
      )}

      {isArmyHolder && holder.troops && (
        <div className="mt-2">
          <TroopChip troops={holder.troops} iconSize="sm" />
        </div>
      )}

      <RelicEssenceRequirement
        className="mt-3"
        essenceCost={essenceCost}
        essenceBalance={essenceBalance}
        missingEssence={missingEssence}
        hasEnoughEssence={hasEnoughEssence}
        balanceLabel="Essence Balance"
      />

      {!compatible && (
        <RelicIncompatibilityNotice relicInfo={relicInfo} recipientType={holder.recipientType} className="mt-2" />
      )}

      {activationError && <p className="mt-2 text-xs font-semibold text-red-300">{activationError}</p>}

      <div className="mt-3 flex justify-end">
        <Button
          variant="gold"
          size="md"
          disabled={!compatible || !hasEnoughEssence || isActivating}
          isLoading={isActivating}
          onClick={() =>
            onActivate({
              holder,
              hasEnoughEssence,
              essenceBalance,
            })
          }
        >
          Activate
        </Button>
      </div>
    </div>
  );
};

const toEntityId = (value: unknown, fallback: ID): ID => {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  if (typeof value === "string") {
    try {
      const parsedBigInt = BigInt(value);
      return Number(parsedBigInt);
    } catch {
      const parsedNumber = Number(value);
      return Number.isNaN(parsedNumber) ? fallback : parsedNumber;
    }
  }

  return fallback;
};

export const RelicActivationSelector = ({
  resourceId,
  displayAmount: _initialDisplayAmount,
  holders,
  onClose,
}: RelicActivationSelectorProps) => {
  const {
    setup: { components, systemCalls },
    account: { account },
  } = useDojo();
  const isBlitz = getIsBlitz();

  const removeRelicFromStore = useUIStore((state) => state.removeRelicFromEntity);
  const triggerRelicsRefresh = useUIStore((state) => state.triggerRelicsRefresh);
  const playerStructures = useUIStore((state) => state.playerStructures);

  const [removedHolderIds, setRemovedHolderIds] = useState<string[]>([]);
  const [activatingHolderId, setActivatingHolderId] = useState<string | null>(null);
  const [activationError, setActivationError] = useState<{ holderId: string | null; message: string | null }>({
    holderId: null,
    message: null,
  });

  const structureNameMap = useMemo(() => {
    const map = new Map<string, string>();
    playerStructures.forEach((structure) => {
      const id = Number(structure.entityId);
      if (Number.isNaN(id)) {
        return;
      }

      try {
        const name = getStructureName(structure.structure, isBlitz).name;
        map.set(String(id), name);
      } catch {
        map.set(String(id), `Realm #${id}`);
      }
    });

    return map;
  }, [playerStructures, isBlitz]);

  const { relicInfo, resourceName, resourceKey, essenceCost } = useRelicMetadata(resourceId);

  const relicDescription = useMemo(() => {
    if (!relicInfo) {
      return undefined;
    }

    if (!relicInfo.duration) {
      return relicInfo.effect;
    }

    return `${relicInfo.effect} (${relicInfo.duration})`;
  }, [relicInfo]);

  const enrichedHolders = useMemo<EnrichedHolder[]>(() => {
    const resolveParentStructureName = (structureId: ID | null): string | null => {
      if (structureId == null) {
        return null;
      }

      const cachedName = structureNameMap.get(String(structureId));
      if (cachedName) {
        return cachedName;
      }

      try {
        const parentInfo = getEntityInfo(structureId, ZERO_CONTRACT_ADDRESS, components, isBlitz);
        return parentInfo?.name?.name ?? null;
      } catch {
        return null;
      }
    };

    return holders.map((holder) => {
      const entityInfo = getEntityInfo(holder.entityId, ZERO_CONTRACT_ADDRESS, components, isBlitz);
      const entityName = entityInfo?.name?.name ?? `Entity ${holder.entityId}`;
      const selfId = toEntityId(holder.entityId, holder.entityId);
      const isArmy = holder.entityType === EntityType.ARMY || holder.recipientType === RelicRecipientType.Explorer;
      const explorerOwnerRaw = isArmy ? entityInfo?.explorer?.owner : undefined;
      const entityOwnerId = isArmy ? toEntityId(explorerOwnerRaw, selfId) : selfId;
      const hasParentStructure = isArmy && entityOwnerId !== selfId;
      const parentStructureId = hasParentStructure ? entityOwnerId : null;
      const parentStructureName = hasParentStructure ? resolveParentStructureName(parentStructureId) : null;
      const troops = isArmy ? ((entityInfo?.explorer?.troops as Troops | undefined) ?? null) : null;

      return {
        ...holder,
        entityOwnerId,
        entityName,
        parentStructureId,
        parentStructureName,
        troops,
      };
    });
  }, [components, holders, structureNameMap, isBlitz]);

  const visibleHolders = useMemo(() => {
    return enrichedHolders.filter((holder) => !removedHolderIds.includes(String(holder.entityId)));
  }, [enrichedHolders, removedHolderIds]);

  const visibleTotalAmount = useMemo(() => {
    return visibleHolders.reduce((total, holder) => total + holder.amount, 0);
  }, [visibleHolders]);

  const visibleDisplayAmount = useMemo(() => {
    if (removedHolderIds.length === 0) {
      return _initialDisplayAmount;
    }
    return currencyFormat(visibleTotalAmount, 0);
  }, [removedHolderIds, visibleTotalAmount, _initialDisplayAmount]);

  const handleActivate = async ({ holder, hasEnoughEssence, essenceBalance }: ActivationRequest) => {
    if (!relicInfo) {
      setActivationError({ holderId: String(holder.entityId), message: "Relic data unavailable." });
      return;
    }

    const holderKey = String(holder.entityId);
    const compatible = isRelicCompatible(relicInfo, holder.recipientType);

    if (!compatible) {
      setActivationError({ holderId: holderKey, message: "This entity cannot activate this relic." });
      return;
    }

    if (!account || account.address === "0x0") {
      setActivationError({ holderId: holderKey, message: "Account not connected." });
      return;
    }

    if (!systemCalls.apply_relic) {
      setActivationError({ holderId: holderKey, message: "Relic activation is not available yet." });
      return;
    }

    if (!hasEnoughEssence) {
      const missingEssence = Math.max(0, essenceCost - essenceBalance);
      setActivationError({
        holderId: holderKey,
        message: "Need " + missingEssence.toLocaleString() + " more essence.",
      });
      return;
    }

    setActivationError({ holderId: null, message: null });
    setActivatingHolderId(holderKey);

    try {
      await systemCalls.apply_relic({
        signer: account,
        entity_id: holder.entityId,
        relic_resource_id: resourceId,
        recipient_type: relicInfo.recipientTypeParam,
      });

      if (account?.address && account.address !== "0x0") {
        removeRelicFromStore({ entityId: holder.entityId, resourceId, recipientType: holder.recipientType });
        triggerRelicsRefresh();
      }

      setActivationError({ holderId: null, message: null });
      setRemovedHolderIds((prev) => {
        if (prev.includes(holderKey)) {
          return prev;
        }
        const updated = [...prev, holderKey];
        const remaining = enrichedHolders.filter((item) => !updated.includes(String(item.entityId)));
        if (remaining.length === 0) {
          onClose();
        }
        return updated;
      });
    } catch (error) {
      console.error("Failed to activate relic:", error);
      setActivationError({ holderId: holderKey, message: "Failed to activate relic. Please try again." });
    } finally {
      setActivatingHolderId(null);
    }
  };

  return (
    <BasePopup title="Select Activation Target" onClose={onClose} contentClassName="max-w-[520px]">
      <div className="space-y-5">
        <RelicSummary
          resourceKey={resourceKey}
          title={resourceName}
          subtitle={`Total available: ${visibleDisplayAmount}`}
          description={relicDescription}
        />

        {visibleHolders.length === 0 ? (
          <div className="rounded border border-gold/20 bg-dark-brown/20 p-6 text-center text-sm text-gold/70">
            No entities currently hold this relic.
          </div>
        ) : (
          <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
            {visibleHolders.map((holder) => {
              const holderKey = String(holder.entityId);
              const isActivating = activatingHolderId === holderKey;
              const holderError = activationError.holderId === holderKey ? activationError.message : null;

              return (
                <RelicActivationHolderCard
                  key={holder.entityId}
                  holder={holder}
                  relicInfo={relicInfo}
                  essenceCost={essenceCost}
                  onActivate={handleActivate}
                  isActivating={isActivating}
                  activationError={holderError}
                />
              );
            })}
          </div>
        )}
      </div>
    </BasePopup>
  );
};
