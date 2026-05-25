import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import type { TransferAutomationEntry } from "@/hooks/store/use-transfer-automation-store";
import type { ProcessedStoryEvent } from "@/hooks/store/use-story-events-store";
import { ResourcesIds } from "@bibliothecadao/types";
import { cn } from "@/ui/design-system/atoms/lib/utils";

type TransferBarModel = {
  id: string;
  kind: "current" | "automation";
  sourceLabel: string;
  destinationLabel: string;
  iconResources: string[];
  progress?: number;
};

type BuildRealmTransferBarModelsOptions = {
  selectedStructureId: number | null;
  currentTimeMs: number;
  storyEvents: ProcessedStoryEvent[];
  automationEntries: TransferAutomationEntry[];
  resolveStructureName: (entityId: number) => string | null;
};

type TransferBarSectionProps = {
  current: TransferBarModel[];
  automation: TransferBarModel[];
  className?: string;
};

type TransferResourceLike = {
  resourceId?: number;
};

const MAX_TRANSFER_ICONS = 3;

const normalizeEntityId = (value: unknown) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof value === "bigint") return Number(value);
  return null;
};

const parseTravelTimeMs = (value: unknown) => {
  if (typeof value === "number") return Number.isFinite(value) ? value * 1000 : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed * 1000 : 0;
  }
  return 0;
};

const parseTransferResources = (raw: unknown): TransferResourceLike[] => {
  if (Array.isArray(raw)) {
    return raw.filter((entry): entry is TransferResourceLike => Boolean(entry) && typeof entry === "object");
  }

  if (typeof raw !== "string" || raw.trim().length === 0) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is TransferResourceLike => Boolean(entry) && typeof entry === "object")
      : [];
  } catch {
    return [];
  }
};

const toIconResources = (resourceIds: number[]) =>
  Array.from(new Set(resourceIds))
    .slice(0, MAX_TRANSFER_ICONS)
    .map((resourceId) => ResourcesIds[resourceId as ResourcesIds])
    .filter((resource): resource is string => typeof resource === "string");

const resolveStructureLabel = (entityId: number, resolveStructureName: (entityId: number) => string | null) =>
  resolveStructureName(entityId) ?? `Structure ${entityId}`;

const isDefined = <T,>(value: T | null): value is T => value !== null;

const buildCurrentTransferBarModels = ({
  selectedStructureId,
  currentTimeMs,
  storyEvents,
  resolveStructureName,
}: Omit<BuildRealmTransferBarModelsOptions, "automationEntries">): TransferBarModel[] => {
  if (!selectedStructureId) return [];

  const bars = storyEvents
    .filter((event) => event.story === "ResourceTransferStory" && !event.resource_transfer_is_mint)
    .map((event): TransferBarModel | null => {
      const sourceId = normalizeEntityId(event.resource_transfer_from_entity_id);
      const destinationId = normalizeEntityId(event.resource_transfer_to_entity_id);
      const travelTimeMs = parseTravelTimeMs(event.resource_transfer_travel_time);
      if (!sourceId || !destinationId || travelTimeMs <= 0) return null;
      if (sourceId !== selectedStructureId && destinationId !== selectedStructureId) return null;

      const startedAtMs = event.timestampMs;
      const endsAtMs = startedAtMs + travelTimeMs;
      if (currentTimeMs >= endsAtMs) return null;

      const resources = parseTransferResources(event.resource_transfer_resources);
      const iconResources = toIconResources(
        resources.map((resource) => Number(resource.resourceId)).filter(Number.isFinite),
      );
      if (iconResources.length === 0) return null;

      const progress = Math.max(0, Math.min((currentTimeMs - startedAtMs) / travelTimeMs, 1));

      return {
        id: event.id,
        kind: "current" as const,
        sourceLabel: resolveStructureLabel(sourceId, resolveStructureName),
        destinationLabel: resolveStructureLabel(destinationId, resolveStructureName),
        iconResources,
        progress,
      };
    })
    .filter(isDefined);

  return bars.toSorted((left, right) => (right.progress ?? 0) - (left.progress ?? 0)).slice(0, 3);
};

const buildAutomationTransferBarModels = ({
  selectedStructureId,
  automationEntries,
  resolveStructureName,
}: Omit<BuildRealmTransferBarModelsOptions, "storyEvents" | "currentTimeMs">): TransferBarModel[] => {
  if (!selectedStructureId) return [];

  const bars = automationEntries
    .filter((entry) => entry.active)
    .map((entry): TransferBarModel | null => {
      const sourceId = normalizeEntityId(entry.sourceEntityId);
      const destinationId = normalizeEntityId(entry.destinationEntityId);
      if (!sourceId || !destinationId) return null;
      if (sourceId !== selectedStructureId && destinationId !== selectedStructureId) return null;

      const iconResources = toIconResources(
        (entry.resourceConfigs?.map((resource) => resource.resourceId) ?? entry.resourceIds).filter(Number.isFinite),
      );
      if (iconResources.length === 0) return null;

      return {
        id: entry.id,
        kind: "automation" as const,
        sourceLabel: entry.sourceName ?? resolveStructureLabel(sourceId, resolveStructureName),
        destinationLabel: entry.destinationName ?? resolveStructureLabel(destinationId, resolveStructureName),
        iconResources,
      };
    })
    .filter(isDefined);

  return bars.slice(0, 3);
};

export const buildRealmTransferBarModels = ({
  selectedStructureId,
  currentTimeMs,
  storyEvents,
  automationEntries,
  resolveStructureName,
}: BuildRealmTransferBarModelsOptions) => ({
  current: buildCurrentTransferBarModels({
    selectedStructureId,
    currentTimeMs,
    storyEvents,
    resolveStructureName,
  }),
  automation: buildAutomationTransferBarModels({
    selectedStructureId,
    automationEntries,
    resolveStructureName,
  }),
});

const TransferBar = ({ bar }: { bar: TransferBarModel }) => {
  const movingTokenStyle =
    bar.kind === "current" && bar.progress !== undefined ? { left: `${bar.progress * 100}%` } : undefined;

  return (
    <div className="rounded border border-gold/15 bg-black/40 px-2 py-2">
      <div className="grid grid-cols-[minmax(0,1fr)_140px_minmax(0,1fr)] items-center gap-2 text-[11px] text-gold/85">
        <div className="truncate text-left">{bar.sourceLabel}</div>
        <div className="relative h-5">
          <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-gold/25" />
          <div
            className={cn(
              "absolute top-1/2 flex -translate-y-1/2 -translate-x-1/2 items-center gap-0.5 rounded-full border border-gold/20 bg-black/80 px-1 py-0.5 shadow-sm",
              bar.kind === "automation" && "animate-transfer-token",
            )}
            style={movingTokenStyle}
          >
            {bar.iconResources.map((resource) => (
              <ResourceIcon key={`${bar.id}-${resource}`} resource={resource} size="xs" withTooltip={false} />
            ))}
          </div>
        </div>
        <div className="truncate text-right">{bar.destinationLabel}</div>
      </div>
    </div>
  );
};

const TransferSection = ({ title, bars }: { title: string; bars: TransferBarModel[] }) => {
  if (bars.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="text-[10px] uppercase tracking-[0.2em] text-gold/45">{title}</div>
      <div className="space-y-1.5">
        {bars.map((bar) => (
          <TransferBar key={bar.id} bar={bar} />
        ))}
      </div>
    </div>
  );
};

export const RealmTransferBars = ({ current, automation, className }: TransferBarSectionProps) => {
  if (current.length === 0 && automation.length === 0) {
    return null;
  }

  return (
    <section className={cn("rounded border border-gold/20 bg-black/50 p-2", className)}>
      <div className="text-xxs uppercase tracking-[0.2em] text-gold/60">Transfers</div>
      <div className="mt-2 space-y-3">
        <TransferSection title="Current" bars={current} />
        <TransferSection title="Automation" bars={automation} />
      </div>
    </section>
  );
};
