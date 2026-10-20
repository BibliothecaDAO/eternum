import { useEffect, useMemo, useState } from "react";
import { resolveExplorerTroops } from "@bibliothecadao/eternum/troop-stamina";

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
import { knownAmount } from "@/ui/utils/utils";
import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { EntityType, ID, RelicRecipientType, Troops, formatAmount } from "@bibliothecadao/types";

import { TroopChip } from "@/ui/features/military/components/troop-chip";
import { isRelicCompatible, useRelicEssenceStatus, useRelicMetadata } from "../hooks/use-relic-activation";
import { HeldRelic, RelicEssenceRequirement, RelicIncompatibilityNotice } from "./relic-activation-shared";
import { accountAddress } from "@/hooks/store/use-account-store";
import { safeInteger } from "@bibliothecadao/eternum/game-client";
import { configManager, getArmyName } from "@bibliothecadao/eternum";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { getExplorerStaminaSnapshot } from "@/lib/army-stamina/source-resolution";
import { activateRelic, relicHolderLine, STAMINA_FULL } from "@/ui/design-system/kit/words";

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
  entityOwnerId: ID | undefined;
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
  onActivate: (request: ActivationRequest) => Promise<void>;
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
  const staminaFull = useStaminaFull(isArmyHolder ? holder.troops : null);
  const armyUnknown = isArmyHolder && holder.troops === null;
  useEffect(() => {
    if (import.meta.env.DEV && armyUnknown)
      console.warn("Relic activation is waiting for synchronized army facts", { entityId: holder.entityId });
  }, [armyUnknown, holder.entityId]);

  return (
    <HudPanel
      kind="section"
      title={holder.entityName}
      cue={`×${formatAmount(knownAmount(holder.amount))}`}
      collapsible={false}
    >
      <div className="flex flex-col gap-2">
        <HudRow
          title={relicHolderLine(isArmyHolder, holder.parentStructureName)}
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
        {compatible && relicInfo?.type === "Stamina" && staminaFull && (
          <HudNotice tone="warn" line={STAMINA_FULL.line} why={STAMINA_FULL.why} />
        )}
        {armyUnknown && <HudNotice tone="warn" line="Army data unavailable. Waiting for synchronization." />}
        {activationError && <HudNotice tone="bad" line={activationError} />}
        <span className="flex justify-end">
          <HudButton
            kind="secondary"
            busy={isActivating ? "Activating…" : undefined}
            disabled={!compatible || !hasEnoughEssence || armyUnknown}
            onClick={() => onActivate({ holder, hasEnoughEssence, shortfall })}
          >
            Activate
          </HudButton>
        </span>
      </div>
    </HudPanel>
  );
};

/** Whether an army's stamina is at its most now: a relic that speeds the refill then has nothing to refill. */
const useStaminaFull = (troops: Troops | null): boolean => {
  const now = useCurrentDefaultTick();
  const stamina = getExplorerStaminaSnapshot({ timestamp: now, liveTroops: troops });
  return stamina !== null && stamina.current >= stamina.max;
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
  const revision = useNativeRevision([
    "Structure",
    "ExplorerTroops",
    "EntityName",
    "ArmySlot",
    "ArmyProgress",
    "SliceRules",
  ]);

  const [activatingHolderId, setActivatingHolderId] = useState<string | null>(null);
  const [activationError, setActivationError] = useState<{ holderId: string | null; message: string | null }>({
    holderId: null,
    message: null,
  });

  const { relicInfo, resourceId: relicResourceId, essenceCost } = useRelicMetadata(resourceId);

  const relicDescription = relicInfo?.effectLine;

  const enrichedHolders = useMemo<EnrichedHolder[]>(() => {
    return holders.map((holder) => {
      const game_id = configManager.getActiveGameId();
      const isArmy = holder.entityType === EntityType.ARMY || holder.recipientType === RelicRecipientType.Explorer;
      const explorer = isArmy ? store.get("ExplorerTroops", { game_id, explorer_id: holder.entityId }) : undefined;
      const entityOwnerId = isArmy ? (explorer ? safeInteger(explorer.owner) : undefined) : holder.entityId;
      const structure =
        entityOwnerId === undefined ? undefined : store.get("Structure", { game_id, entity_id: entityOwnerId });
      const entityName = isArmy
        ? getArmyName(holder.entityId, store)
        : structure
          ? mode.structure.getName(structure).name
          : "Structure";
      const parentStructureId = isArmy ? (entityOwnerId ?? null) : null;
      const parentStructureName = isArmy && structure ? mode.structure.getName(structure).name : null;
      const troops = explorer ? (resolveExplorerTroops(store, explorer) ?? null) : null;

      return {
        ...holder,
        entityOwnerId,
        entityName,
        parentStructureId,
        parentStructureName,
        troops,
      };
    });
  }, [store, holders, mode, revision]);

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
    <HudWindow title={activateRelic(relicResourceId)} icon="relics" size="task" onClose={onClose}>
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
