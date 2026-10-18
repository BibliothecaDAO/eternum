import { useMemo, useState } from "react";
import { useFactView } from "@/hooks/use-fact-view";
import { playerStructuresView } from "@/sync/fact-views";

import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import {
  HudButton,
  HudChip,
  HudEmpty,
  HudNotice,
  HudPanel,
  HudRow,
  HudWindow,
} from "@/ui/design-system/kit/hud-elements";
import { currencyFormat } from "@/ui/utils/utils";
import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { EntityType, ID, RelicRecipientType, Troops } from "@bibliothecadao/types";

import { TroopChip } from "@/ui/features/military/components/troop-chip";
import { isRelicCompatible, useRelicEssenceStatus, useRelicMetadata } from "../hooks/use-relic-activation";
import {
  essencePrice,
  HeldRelic,
  RelicEssenceRequirement,
  RelicIncompatibilityNotice,
} from "./relic-activation-shared";
import { accountAddress } from "@/hooks/store/use-account-store";
import { safeInteger } from "@bibliothecadao/eternum/game-client";

/** A structure or army holding a relic, with how many it holds: one choice of who activates it. */
export interface RelicHolderPreview {
  entityId: ID;
  amount: number;
  recipientType: RelicRecipientType;
  entityType: EntityType;
}

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
  shortfall: string;
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
  const { essenceBalance, hasEnoughEssence, shortfall } = useRelicEssenceStatus(holder.entityOwnerId, essenceCost);
  const compatible = isRelicCompatible(relicInfo, holder.recipientType);
  const isArmyHolder = holder.entityType === EntityType.ARMY || holder.recipientType === RelicRecipientType.Explorer;
  const parentRealmLabel = (() => {
    if (holder.parentStructureName) return holder.parentStructureName;
    return holder.parentStructureId != null ? "Realm" : null;
  })();

  return (
    <HudPanel kind="section" title={holder.entityName} cue={`×${currencyFormat(holder.amount, 0)}`} collapsible={false}>
      <div className="flex flex-col gap-2">
        <HudRow
          title={`ID: ${holder.entityId}`}
          detail={isArmyHolder && parentRealmLabel ? `Parent Realm · ${parentRealmLabel}` : undefined}
          trail={
            <span className="flex gap-1">
              <HudChip tone={compatible ? "good" : "bad"}>{compatible ? "Compatible" : "Incompatible"}</HudChip>
              <HudChip tone={hasEnoughEssence ? "good" : "bad"}>
                {hasEnoughEssence ? "Enough essence" : "Need essence"}
              </HudChip>
            </span>
          }
        />
        {isArmyHolder && holder.troops && <TroopChip troops={holder.troops} size="sm" />}
        <RelicEssenceRequirement
          essenceCost={essenceCost}
          essenceBalance={essenceBalance}
          shortfall={shortfall}
          hasEnoughEssence={hasEnoughEssence}
        />
        {!compatible && <RelicIncompatibilityNotice relicInfo={relicInfo} recipientType={holder.recipientType} />}
        {activationError && <HudNotice tone="bad" line={activationError} />}
        <span className="flex justify-end">
          <HudButton
            kind="secondary"
            prices={essencePrice(essenceCost)}
            busy={isActivating ? "Activating…" : undefined}
            disabled={!compatible || !hasEnoughEssence}
            onClick={() => onActivate({ holder, hasEnoughEssence, shortfall })}
          >
            Activate
          </HudButton>
        </span>
      </div>
    </HudPanel>
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
    setup: { store, systemCalls },
    account: { account },
  } = useGame();
  const mode = useGameModeConfig();
  const revision = useNativeRevision(["Structure", "ExplorerTroops", "TileOccupancy"]);

  const playerStructures = useFactView(playerStructuresView);

  const [activatingHolderId, setActivatingHolderId] = useState<string | null>(null);
  const [activationError, setActivationError] = useState<{ holderId: string | null; message: string | null }>({
    holderId: null,
    message: null,
  });

  const structureNameMap = useMemo(() => {
    const map = new Map<string, string>();
    playerStructures.forEach((structure) => {
      const id = safeInteger(structure.entityId);
      if (Number.isNaN(id)) {
        return;
      }

      try {
        const name = mode.structure.getName(structure.structure).name;
        map.set(String(id), name);
      } catch {
        map.set(String(id), "Structure");
      }
    });

    return map;
  }, [mode, playerStructures]);

  const { relicInfo, resourceId: relicResourceId, essenceCost } = useRelicMetadata(resourceId);

  const relicDescription = relicInfo?.effectLine;

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
        const parentInfo = mode.structure.getEntityInfo(structureId, null, store);
        return parentInfo?.name?.name ?? null;
      } catch {
        return null;
      }
    };

    return holders.map((holder) => {
      const entityInfo = mode.structure.getEntityInfo(holder.entityId, null, store);
      const isArmy = holder.entityType === EntityType.ARMY || holder.recipientType === RelicRecipientType.Explorer;
      const entityName = entityInfo?.name?.name ?? (isArmy ? "Army" : "Structure");
      const selfId = toEntityId(holder.entityId, holder.entityId);
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
  }, [store, holders, mode, structureNameMap, revision]);

  const visibleHolders = enrichedHolders;
  const visibleDisplayAmount = _initialDisplayAmount;

  const handleActivate = async ({ holder, hasEnoughEssence, shortfall }: ActivationRequest) => {
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

    if (!account || accountAddress() === null) {
      setActivationError({ holderId: holderKey, message: "Account not connected." });
      return;
    }

    if (!systemCalls.apply_relic) {
      setActivationError({ holderId: holderKey, message: "Relic activation is not available yet." });
      return;
    }

    if (!hasEnoughEssence) {
      setActivationError({ holderId: holderKey, message: shortfall });
      return;
    }

    setActivationError({ holderId: null, message: null });
    setActivatingHolderId(holderKey);

    try {
      await systemCalls.apply_relic!({
        signer: account,
        entity_id: holder.entityId,
        relic_resource_id: resourceId,
        recipient_type: relicInfo.recipientTypeParam,
      });

      setActivationError({ holderId: null, message: null });
      onClose();
    } catch (error) {
      console.error("Failed to activate relic:", error);
      setActivationError({ holderId: holderKey, message: "Failed to activate relic. Please try again." });
    } finally {
      setActivatingHolderId(null);
    }
  };

  return (
    <HudWindow title="Select Activation Target" icon="relics" size="task" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <HeldRelic relicId={relicResourceId} held={visibleDisplayAmount} />
        {relicDescription && <p className="text-hud-label text-hud-muted">{relicDescription}</p>}
        {visibleHolders.length === 0 ? (
          <HudEmpty icon="relics" line="No entities currently hold this relic." />
        ) : (
          visibleHolders.map((holder) => {
            const holderKey = String(holder.entityId);
            return (
              <RelicActivationHolderCard
                key={holder.entityId}
                holder={holder}
                relicInfo={relicInfo}
                essenceCost={essenceCost}
                onActivate={handleActivate}
                isActivating={activatingHolderId === holderKey}
                activationError={activationError.holderId === holderKey ? activationError.message : null}
              />
            );
          })
        )}
      </div>
    </HudWindow>
  );
};
