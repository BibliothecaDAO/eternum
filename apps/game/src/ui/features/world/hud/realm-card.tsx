import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
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
import {
  formatPopulationStatusLabel,
  formatUsedBuildingTilesLabel,
} from "@/ui/features/world/containers/structure-status";
import type { StructureWithMetadata } from "@/ui/features/world/containers/top-header/structure-picker/chip";
import { resolveStructureUiCapabilities } from "@/ui/lib/structure-capabilities";
import { canIssueOrders } from "@/utils/can-issue-orders";
import { divideByPrecision, type ResourceManager } from "@bibliothecadao/eternum";
import { inferRealmPreset, type RealmPresetId } from "@bibliothecadao/eternum/automation";
import { safeInteger } from "@bibliothecadao/eternum/game-client";
import { EntityType, type ID, isRelic, RelicRecipientType, ResourcesIds, StructureType } from "@bibliothecadao/types";
import { useMemo } from "react";
import { ProductionStatusBadge } from "@/ui/shared";
import { resourcesInTierOrder } from "@/ui/shared/resource-tier-order";

/**
 * The selected holding of the player's: its name with rename, its population, building tiles and automation, then a
 * medallion per resource it makes or holds (five to a row, by id), then its relics. Nothing for a holding not theirs.
 */
export const RealmCard = ({ holding }: { holding: StructureWithMetadata | null }) => {
  const entityId = useUIStore((state) => state.structureEntityId);
  const detail = useStructureEntityDetail({ structureEntityId: entityId });
  const summary = useStructureProductionSummary(detail.structure, detail.resources);
  if (detail.isLoadingStructure || !detail.structure || !detail.isMine) return null;
  const isVillage = isVillageLikeStructureCategory(detail.structure.base.category);
  return (
    <section aria-label="Selected holding" className="flex min-w-0 flex-col gap-2">
      <CardHeader
        entityId={entityId}
        name={detail.structureName ?? detail.typeLabel ?? "Holding"}
        holding={holding}
        automation={isVillage ? "village" : detail.structure.base.category === StructureType.Realm ? "realm" : null}
      />
      <ResourceRings resources={detail.resources} summary={summary} />
      <HeldRelics entityId={entityId} resources={detail.resources} activeRelicIds={detail.relicEffects} />
    </section>
  );
};

/** The name on its own line, with rename beside it; under it the holding's population, tiles and automation. */
const CardHeader = ({
  entityId,
  name,
  holding,
  automation,
}: {
  entityId: ID;
  name: string;
  holding: StructureWithMetadata | null;
  automation: "realm" | "village" | null;
}) => {
  const rename = useUIStore((state) => state.setPendingRenameStructureEntityId);
  return (
    <header className="flex min-w-0 flex-col gap-1">
      <div className="flex min-w-0 items-center gap-1">
        <h2 className="hud-card-title min-w-0 truncate" title={name}>
          {name}
        </h2>
        <button
          type="button"
          aria-label="Rename"
          title="Rename"
          onClick={() => rename(safeInteger(entityId))}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-kit-muted hover:text-gold"
        >
          <Icon name="edit" size={16} />
        </button>
      </div>
      <div className="flex min-h-9 items-center gap-4 text-sm font-semibold tabular-nums text-kit-cream">
        {holding && <HoldingStats holding={holding} />}
        <span className="flex-1" />
        {automation && <AutomationSelect entityId={entityId} entityType={automation} />}
      </div>
    </header>
  );
};

/** Population used of its room, and building tiles used of those open, as the structure list reads them. */
const HoldingStats = ({ holding }: { holding: StructureWithMetadata }) => {
  if (!resolveStructureUiCapabilities(holding.structure).hasPopulationDetails) return null;
  const tiles =
    holding.buildingTilesOccupied !== null && holding.buildingTilesTotal !== null
      ? formatUsedBuildingTilesLabel(holding.buildingTilesOccupied, holding.buildingTilesTotal)
      : null;
  return (
    <>
      <span className="flex items-center gap-1.5" title="Population used / capacity">
        <Icon name="people" size={16} />
        {formatPopulationStatusLabel(holding.population, holding.populationCapacity)}
      </span>
      {tiles && (
        <span className="flex items-center gap-1.5" title="Building tiles used / open">
          <Icon name="hexagon" size={16} />
          {tiles}
        </span>
      )}
    </>
  );
};

/** The three automation presets; "idle" is shown as Off, since an idle realm is one whose automation is off. */
const PRESETS: Array<{ id: RealmPresetId; label: string }> = [
  { id: "smart", label: "Smart" },
  { id: "custom", label: "Custom" },
  { id: "idle", label: "Off" },
];

const AutomationSelect = ({ entityId, entityType }: { entityId: ID; entityType: "realm" | "village" }) => {
  const showAutomation = useGameModeConfig().ui.showAutomation;
  const realmId = String(entityId);
  const automation = useAutomationStore((state) => state.realms[realmId]);
  const hydrated = useAutomationStore((state) => state.hydrated);
  const ordersAllowed = useUIStore(canIssueOrders);
  if (!showAutomation) return null;
  const choose = (presetId: RealmPresetId) => {
    const store = useAutomationStore.getState();
    store.upsertRealm(realmId, { entityType, presetId });
    store.setRealmPreset(realmId, presetId);
  };
  return (
    <select
      aria-label="Production automation"
      className="hud-select shrink-0"
      value={inferRealmPreset(automation)}
      disabled={!ordersAllowed || !hydrated}
      onKeyDown={(event) => event.stopPropagation()}
      onChange={(event) => choose(event.target.value as RealmPresetId)}
    >
      {PRESETS.map((preset) => (
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
    const { resourceIds, militaryIds } = resourcesInTierOrder(
      mode.resources.getTiers() as Record<string, ResourcesIds[]>,
    );
    return [...resourceIds, ...militaryIds].flatMap((resourceId) => {
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
  if (readings.length === 0) return <p className="text-sm text-kit-muted">No resources yet.</p>;
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
  if (producing && secondsLeft !== null && secondsLeft >= 60)
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
