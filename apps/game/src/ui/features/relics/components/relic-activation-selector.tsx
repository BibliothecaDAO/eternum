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
import { useGame } from "@/hooks/context/game-context";
import { ActionFailureNotice } from "@/ui/features/event-feed/action-failure-notice";
import { type ActionFailure, actionFailure } from "@/ui/features/event-feed/notify";
import { useActNowRefusal } from "@/utils/can-issue-orders";
import { useNativeFacts } from "@/hooks/helpers/use-native-facts";
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

/** A structure or army holding a relic, with how many whole relics it holds: one choice of who activates it. */
export interface RelicHolderPreview {
  entityId: ID;
  held: number;
  recipientType: RelicRecipientType;
  entityType: EntityType;
}

interface RelicActivationSelectorProps {
  resourceId: ID;
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
  failure?: ActionFailure | null;
};

const RelicActivationHolderCard = ({
  holder,
  relicInfo,
  essenceCost,
  onActivate,
  isActivating,
  failure,
}: RelicActivationHolderCardProps) => {
  const { essenceBalance, hasEnoughEssence, shortfall } = useRelicEssenceStatus(holder.entityOwnerId, essenceCost);
  const compatible = isRelicCompatible(relicInfo, holder.recipientType);
  const isArmyHolder = holder.entityType === EntityType.ARMY || holder.recipientType === RelicRecipientType.Explorer;
  const staminaFull = useStaminaFull(isArmyHolder ? holder.troops : null);
  const armyUnknown = isArmyHolder && holder.troops === null;
  // Why the game takes no action yet ("Starts in 2m 33s"): Activate says so before the click, and stays shut.
  const refusal = useActNowRefusal();
  useEffect(() => {
    if (import.meta.env.DEV && armyUnknown)
      console.warn("Relic activation is waiting for synchronized army facts", { entityId: holder.entityId });
  }, [armyUnknown, holder.entityId]);

  return (
    <HudPanel kind="section" title={holder.entityName} cue={`×${formatAmount(holder.held)}`} collapsible={false}>
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
        {refusal !== null && <HudNotice line={refusal} />}
        {failure && <ActionFailureNotice failure={failure} />}
        <span className="flex justify-end">
          <HudButton
            kind="secondary"
            busy={isActivating ? "Activating…" : undefined}
            disabled={refusal !== null || !compatible || !hasEnoughEssence || armyUnknown}
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

export const RelicActivationSelector = ({ resourceId, holders, onClose }: RelicActivationSelectorProps) => {
  const {
    setup: { systemCalls },
    account: { account },
  } = useGame();
  const mode = useGameModeConfig();
  const facts = useNativeFacts(["Structure", "ExplorerTroops", "EntityName", "ArmySlot", "ArmyProgress", "SliceRules"]);

  const [activatingHolderId, setActivatingHolderId] = useState<string | null>(null);
  // The holder whose last press did not activate, and why: told until the next press.
  const [activationError, setActivationError] = useState<{ holderId: string | null; failure: ActionFailure | null }>({
    holderId: null,
    failure: null,
  });

  const { relicInfo, resourceId: relicResourceId, essenceCost } = useRelicMetadata(resourceId);

  const relicDescription = relicInfo?.effectLine;

  const enrichedHolders = useMemo<EnrichedHolder[]>(() => {
    return holders.map((holder) => {
      const game_id = configManager.getActiveGameId();
      const isArmy = holder.entityType === EntityType.ARMY || holder.recipientType === RelicRecipientType.Explorer;
      const explorer = isArmy
        ? facts.store.get("ExplorerTroops", { game_id, explorer_id: holder.entityId })
        : undefined;
      const entityOwnerId = isArmy ? (explorer ? safeInteger(explorer.owner) : undefined) : holder.entityId;
      const structure =
        entityOwnerId === undefined ? undefined : facts.store.get("Structure", { game_id, entity_id: entityOwnerId });
      const entityName = isArmy
        ? getArmyName(holder.entityId, facts.store)
        : structure
          ? mode.structure.getName(structure).name
          : "Structure";
      const parentStructureId = isArmy ? (entityOwnerId ?? null) : null;
      const parentStructureName = isArmy && structure ? mode.structure.getName(structure).name : null;
      const troops = explorer ? (resolveExplorerTroops(facts.store, explorer) ?? null) : null;

      return {
        ...holder,
        entityOwnerId,
        entityName,
        parentStructureId,
        parentStructureName,
        troops,
      };
    });
  }, [holders, mode, facts]);

  const held = holders.reduce((total, holder) => total + holder.held, 0);

  const failed = (holderId: string, reason: string) =>
    setActivationError({ holderId, failure: { refused: false, reason } });

  const handleActivate = async ({ holder, hasEnoughEssence, shortfall }: ActivationRequest) => {
    if (!relicInfo) {
      failed(String(holder.entityId), "Relic data unavailable.");
      return;
    }

    const holderKey = String(holder.entityId);
    const compatible = isRelicCompatible(relicInfo, holder.recipientType);

    if (!compatible) {
      failed(holderKey, "This entity cannot activate this relic.");
      return;
    }

    if (!account || accountAddress() === null) {
      failed(holderKey, "Account not connected.");
      return;
    }

    if (!systemCalls.apply_relic) {
      failed(holderKey, "Relic activation is not available yet.");
      return;
    }

    if (!hasEnoughEssence) {
      failed(holderKey, shortfall);
      return;
    }

    setActivationError({ holderId: null, failure: null });
    setActivatingHolderId(holderKey);

    try {
      await systemCalls.apply_relic!({
        signer: account,
        entity_id: holder.entityId,
        relic_resource_id: resourceId,
        recipient_type: relicInfo.recipientTypeParam,
      });

      setActivationError({ holderId: null, failure: null });
      onClose();
    } catch (error) {
      setActivationError({
        holderId: holderKey,
        failure: actionFailure(error, "Failed to activate relic. Please try again."),
      });
    } finally {
      setActivatingHolderId(null);
    }
  };

  return (
    <HudWindow title={activateRelic(relicResourceId)} icon="relics" size="task" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <HeldRelic relicId={relicResourceId} held={formatAmount(held)} />
        {relicDescription && <p className="text-hud-label text-hud-muted">{relicDescription}</p>}
        {enrichedHolders.length === 0 ? (
          <HudEmpty icon="relics" line="No entities currently hold this relic." />
        ) : (
          enrichedHolders.map((holder) => {
            const holderKey = String(holder.entityId);
            return (
              <RelicActivationHolderCard
                key={holder.entityId}
                holder={holder}
                relicInfo={relicInfo}
                essenceCost={essenceCost}
                onActivate={handleActivate}
                isActivating={activatingHolderId === holderKey}
                failure={activationError.holderId === holderKey ? activationError.failure : null}
              />
            );
          })
        )}
      </div>
    </HudWindow>
  );
};
