import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { automationRefusal, presetLine } from "@/ui/features/settlement/production/automation-words";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { useAutomationStore } from "@/hooks/store/use-automation-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { isVillageLikeStructureCategory } from "@/lib/structure-type-utils";
import { formatTimeRemaining } from "@/ui/features/economy/resources/entity-resource-table/utils";
import {
  CompactEntityInventory,
  formatInventoryAmount,
} from "@/ui/features/world/components/entities/compact-entity-inventory";
import { useStructureEntityDetail } from "@/ui/features/world/components/entities/hooks/use-structure-entity-detail";
import {
  type StructureProductionSummary,
  useStructureProductionSummary,
} from "@/ui/features/world/components/entities/structure-production-summary";
import { Icon } from "@/ui/design-system/icon";
import { HudIconButton, HudPanel } from "@/ui/design-system/kit/hud-elements";
import {
  formatPopulationStatusLabel,
  formatUsedBuildingTilesLabel,
} from "@/ui/features/world/containers/structure-status";
import type { StructureWithMetadata } from "@/ui/features/world/containers/top-header/structure-picker/chip";
import { resolveStructureUiCapabilities } from "@/ui/lib/structure-capabilities";
import { canIssueOrders } from "@/utils/can-issue-orders";
import { divideByPrecision, type ResourceManager } from "@bibliothecadao/eternum";
import { inferRealmPreset, REALM_PRESETS, type RealmPresetId } from "@bibliothecadao/eternum/automation";
import { safeInteger } from "@bibliothecadao/eternum/game-client";
import { EntityType, type ID, isRelic, RelicRecipientType, ResourcesIds, StructureType } from "@bibliothecadao/types";
import { useMemo } from "react";
import { ProductionStatusBadge } from "@/ui/shared";
import { resourcesInTierOrder } from "@/ui/shared/resource-tier-order";

/**
 * The selected holding of the player's, in a HUD panel named for it with rename beside the name: its population,
 * building tiles and automation, then a medallion per resource it makes or holds (five to a row), then its relics.
 * Nothing for a holding not theirs.
 */
export const RealmCard = ({ holding }: { holding: StructureWithMetadata | null }) => {
  const entityId = useUIStore((state) => state.structureEntityId);
  const detail = useStructureEntityDetail({ structureEntityId: entityId });
  const summary = useStructureProductionSummary(detail.structure, detail.resources);
  if (detail.isLoadingStructure || !detail.structure || !detail.isMine) return null;
  const isVillage = isVillageLikeStructureCategory(detail.structure.base.category);
  return (
    <HudPanel
      label="Selected holding"
      title={detail.structureName ?? detail.typeLabel ?? "Holding"}
      cue={<RenameButton entityId={entityId} />}
      className="flex min-h-0 flex-col"
      bodyClassName="min-h-0 overflow-y-auto scrollbar-thin"
    >
      <div className="flex min-w-0 flex-col gap-2">
        <HoldingLine
          entityId={entityId}
          holding={holding}
          automation={isVillage ? "village" : detail.structure.base.category === StructureType.Realm ? "realm" : null}
        />
        <ResourceRings resources={detail.resources} summary={summary} />
        <HeldRelics entityId={entityId} resources={detail.resources} activeRelicIds={detail.relicEffects} />
      </div>
    </HudPanel>
  );
};

/** Rename, beside the holding's name in its panel's header. */
const RenameButton = ({ entityId }: { entityId: ID }) => {
  const rename = useUIStore((state) => state.setPendingRenameStructureEntityId);
  return (
    <HudIconButton icon="edit" label="Rename" kind="quiet" size="sm" onClick={() => rename(safeInteger(entityId))} />
  );
};

/** The holding's population, tiles and automation, on one line under its panel's header. */
const HoldingLine = ({
  entityId,
  holding,
  automation,
}: {
  entityId: ID;
  holding: StructureWithMetadata | null;
  automation: "realm" | "village" | null;
}) => (
  <div className="flex min-h-9 items-center gap-4 text-hud-strong tabular-nums text-hud-ink">
    {holding && <HoldingStats holding={holding} />}
    <span className="flex-1" />
    {automation && <AutomationSelect entityId={entityId} entityType={automation} />}
  </div>
);

/** Population used of its room, and building tiles used of those open, as the structure list reads them. */
const HoldingStats = ({ holding }: { holding: StructureWithMetadata }) => {
  if (!resolveStructureUiCapabilities(holding.structure).hasPopulationDetails) return null;
  const tiles =
    holding.buildingTilesOccupied !== null && holding.buildingTilesTotal !== null
      ? formatUsedBuildingTilesLabel(holding.buildingTilesOccupied, holding.buildingTilesTotal)
      : null;
  return (
    <>
      <span
        className="flex items-center gap-1.5"
        data-tip={`Population ${holding.population.toLocaleString()} of ${holding.populationCapacity.toLocaleString()}`}
      >
        <Icon name="people" size={16} />
        {formatPopulationStatusLabel(holding.population, holding.populationCapacity)}
      </span>
      {tiles && (
        <span
          className="flex items-center gap-1.5"
          data-tip={`Building slots ${holding.buildingTilesOccupied} of ${holding.buildingTilesTotal}`}
        >
          <Icon name="hexagon" size={16} />
          {tiles}
        </span>
      )}
    </>
  );
};

const AutomationSelect = ({ entityId, entityType }: { entityId: ID; entityType: "realm" | "village" }) => {
  const showAutomation = useGameModeConfig().ui.showAutomation;
  const realmId = String(entityId);
  const automation = useAutomationStore((state) => state.realms[realmId]);
  const hydrated = useAutomationStore((state) => state.hydrated);
  const ordersAllowed = useUIStore(canIssueOrders);
  if (!showAutomation) return null;
  const current = inferRealmPreset(automation);
  const refusal = automationRefusal(ordersAllowed, hydrated);
  const choose = (presetId: RealmPresetId) => {
    const store = useAutomationStore.getState();
    store.upsertRealm(realmId, { entityType, presetId });
    store.setRealmPreset(realmId, presetId);
  };
  return (
    <select
      aria-label="Production automation"
      className="hud-select shrink-0"
      value={current}
      data-tip={refusal ?? presetLine(current)}
      disabled={refusal !== null}
      onKeyDown={(event) => event.stopPropagation()}
      onChange={(event) => choose(event.target.value as RealmPresetId)}
    >
      {REALM_PRESETS.map((preset) => (
        <option key={preset.id} value={preset.id}>
          {preset.label}
        </option>
      ))}
    </select>
  );
};

type ResourceReading = {
  resourceId: ResourcesIds;
  held: number;
  buildings: number;
  producing: boolean;
  secondsLeft: number | null;
};

/** What a holding makes or holds, in the classic HUD's tier order: never a resource it neither makes nor holds. */
const useResourceReadings = (resources: ResourceManager | null | undefined, summary: StructureProductionSummary) => {
  const now = useCurrentDefaultTick();
  const mode = useGameModeConfig();
  return useMemo<ResourceReading[]>(() => {
    const held = new Map<number, number>();
    for (const balance of resources?.balances(now) ?? []) {
      held.set(Number(balance.resourceId), divideByPrecision(Number(balance.amount)));
    }
    const made = new Map(summary.items.map((item) => [item.resourceId, item]));
    return resourcesInTierOrder(mode.resources.getTiers() as Record<string, ResourcesIds[]>).flatMap((resourceId) => {
      const item = made.get(resourceId);
      const amount = held.get(resourceId) ?? 0;
      if (!item && amount <= 0) return [];
      return [
        {
          resourceId,
          held: amount,
          buildings: item?.totalBuildings ?? 0,
          producing: Boolean(item?.isProducing),
          secondsLeft: item?.timeRemainingSeconds ?? null,
        },
      ];
    });
  }, [resources, summary, now, mode]);
};

/** The holding's resources as the one resource ring, five to a row. */
const ResourceRings = ({
  resources,
  summary,
}: {
  resources: ResourceManager | null | undefined;
  summary: StructureProductionSummary;
}) => {
  const readings = useResourceReadings(resources, summary);
  if (readings.length === 0) return <p className="text-hud-body text-hud-muted">No resources yet.</p>;
  return (
    <ul aria-label="Resources" className="grid grid-cols-5 justify-items-center gap-y-5 pb-2 pt-2">
      {readings.map((reading) => (
        <li key={reading.resourceId} aria-label={describeResource(reading)}>
          <ProductionStatusBadge
            resource={reading.resourceId}
            isProducing={reading.producing}
            timeRemainingSeconds={reading.secondsLeft}
            buildings={reading.buildings}
            amount={formatInventoryAmount(reading.held)}
            size="md"
          />
        </li>
      ))}
    </ul>
  );
};

/** "Wheat · 12,400 held · 3 buildings · 4h of production left": the ring's tooltip. */
const describeResource = ({ resourceId, held, buildings, producing, secondsLeft }: ResourceReading): string => {
  const parts = [`${ResourcesIds[resourceId]} · ${Math.floor(held).toLocaleString()} held`];
  if (buildings > 0) parts.push(`${buildings} building${buildings === 1 ? "" : "s"}`);
  if (producing && secondsLeft === Number.POSITIVE_INFINITY) parts.push("production never runs out");
  else if (producing && secondsLeft !== null && secondsLeft >= 60)
    parts.push(`${formatTimeRemaining(Math.ceil(secondsLeft / 60) * 60)} of production left`);
  return parts.join(" · ");
};

/** The holding's relics, on their own row, activated from there as on the classic panel. */
const HeldRelics = ({
  entityId,
  resources,
  activeRelicIds,
}: {
  entityId: ID;
  resources: ResourceManager | null | undefined;
  activeRelicIds: Array<{ id: number | string }>;
}) => {
  const now = useCurrentDefaultTick();
  const hasRelics = (resources?.balances(now) ?? []).some(
    (balance) => isRelic(Number(balance.resourceId)) && Number(balance.amount) > 0,
  );
  if (!hasRelics) return null;
  return (
    <CompactEntityInventory
      resources={resources}
      activeRelicIds={activeRelicIds.map((effect) => Number(effect.id))}
      recipientType={RelicRecipientType.Structure}
      entityId={safeInteger(entityId)}
      entityType={EntityType.STRUCTURE}
      allowRelicActivation
      variant="tight"
      filter="relics"
      emptyMessage=""
      showHiddenCount={false}
    />
  );
};
