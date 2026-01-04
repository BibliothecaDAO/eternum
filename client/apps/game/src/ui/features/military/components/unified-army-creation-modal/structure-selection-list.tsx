import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { sqlApi } from "@/services/api";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { useExplorersByStructure } from "@bibliothecadao/react";
import { Guard } from "@bibliothecadao/torii";
import { RealmInfo, StructureType } from "@bibliothecadao/types";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { AlertTriangle, ChevronRight, Shield, Swords } from "lucide-react";
import { useMemo } from "react";

import type { TroopSelectionOption } from "./types";

interface StructureSelectionListProps {
  structures: RealmInfo[];
  selectedStructureId: number | null;
  inventories: Map<number, TroopSelectionOption[]>;
  onSelect: (structureId: number) => void;
}

const StructureSelectionItem = ({
  realm,
  isSelected,
  inventoryOptions,
  guardsData,
  onSelect,
}: {
  realm: RealmInfo;
  isSelected: boolean;
  inventoryOptions: TroopSelectionOption[] | undefined;
  /** Guards data passed from parent (batched fetch) */
  guardsData: Guard[] | undefined;
  onSelect: () => void;
}) => {
  const mode = useGameModeConfig();
  const explorers = useExplorersByStructure({ structureEntityId: realm.entityId });

  // Filter to non-empty guards for display
  const nonEmptyGuards = useMemo(
    () => (guardsData ?? []).filter((guard) => guard.troops?.count && guard.troops.count > 0n),
    [guardsData],
  );

  const name = mode.structure.getName(realm.structure).name;
  const maxExplorers = realm.structure.base.troop_max_explorer_count || 0;
  const maxGuards = realm.structure.base.troop_max_guard_count || 0;
  const attackCount = explorers.length;
  const defenseCount = nonEmptyGuards.length;
  const attackAvailable = maxExplorers > 0 && attackCount < maxExplorers;
  const defenseAvailable = maxGuards > 0 && defenseCount < maxGuards;
  const needsAttention = attackAvailable || defenseAvailable;
  const isRealm = realm.structure.base.category === StructureType.Realm;

  const availableTroops =
    inventoryOptions?.flatMap((option) =>
      option.tiers
        .filter((tier) => tier.available > 0)
        .map((tier) => ({
          key: `${option.type}-${tier.tier}`,
          label: `${option.label} ${tier.tier}`,
          available: tier.available,
          resourceTrait: tier.resourceTrait,
        })),
    ) ?? [];

  availableTroops.sort((a, b) => b.available - a.available);
  const topTroops = availableTroops.slice(0, 4);
  const totalTroops = availableTroops.reduce((sum, troop) => sum + troop.available, 0);

  const containerClasses = clsx(
    "px-4 py-3 rounded-lg panel-wood cursor-pointer transition-all transform hover:scale-[1.02]",
    isSelected ? "panel-gold shadow-lg border-transparent" : "border-transparent hover:bg-gold/5",
  );

  return (
    <button type="button" onClick={onSelect} aria-pressed={isSelected} className={containerClasses}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-gold text-lg font-bold leading-tight">{name}</h4>
        </div>
        <ChevronRight
          className={clsx("w-5 h-5 transition-transform", isSelected ? "text-gold rotate-90" : "text-gold/60")}
        />
      </div>

      {(needsAttention || isRealm) && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {needsAttention && (
            <span
              className={clsx(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                isRealm ? "bg-amber-400/20 text-amber-200" : "bg-sky-400/20 text-sky-100",
              )}
            >
              <AlertTriangle className="h-3 w-3" /> Needs Attention
            </span>
          )}
          {attackAvailable && (
            <span className="inline-flex items-center gap-1 rounded-full bg-brown/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gold/80">
              Open Attack Slot
            </span>
          )}
          {defenseAvailable && (
            <span className="inline-flex items-center gap-1 rounded-full bg-brown/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gold/80">
              Open Defense Slot
            </span>
          )}
          <span className="inline-flex items-center gap-1 rounded-full bg-brown/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gold/70">
            {StructureType[realm.structure.base.category]}
          </span>
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="flex items-center gap-2 bg-brown/30 rounded-lg px-3 py-2">
          <Swords className="w-4 h-4 text-gold" />
          <div>
            <p className="text-xs text-gold/60 uppercase tracking-wide">Attack</p>
            <p className="text-sm font-semibold text-gold">
              {attackCount} / {maxExplorers}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-brown/30 rounded-lg px-3 py-2">
          <Shield className="w-4 h-4 text-gold" />
          <div>
            <p className="text-xs text-gold/60 uppercase tracking-wide">Defense</p>
            <p className="text-sm font-semibold text-gold">
              {defenseCount} / {maxGuards}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-3 bg-brown/25 border border-brown/30 rounded-lg px-3 py-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-gold/70 uppercase tracking-wide">Troops Available</p>
          <span className="text-[10px] font-semibold text-gold/60">Total {totalTroops.toLocaleString()}</span>
        </div>
        {topTroops.length > 0 ? (
          <div className="space-y-2">
            {topTroops.map((troop) => (
              <div key={troop.key} className="flex items-center justify-between rounded-lg bg-brown/20 px-2 py-1">
                <div className="flex items-center gap-2">
                  <ResourceIcon resource={troop.resourceTrait} size="xs" withTooltip={false} />
                  <span className="text-xs font-semibold text-gold/90">{troop.label}</span>
                </div>
                <span className="text-xs text-gold/70 font-medium">{troop.available.toLocaleString()}</span>
              </div>
            ))}
            {availableTroops.length > topTroops.length && (
              <p className="text-[10px] text-gold/50">
                + {availableTroops.length - topTroops.length} more combinations
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-gold/50">No troops currently stored.</p>
        )}
      </div>
    </button>
  );
};

export const StructureSelectionList = ({
  structures,
  selectedStructureId,
  inventories,
  onSelect,
}: StructureSelectionListProps) => {
  const mode = useGameModeConfig();

  // Batch fetch guards for ALL structures in a single query
  // This replaces N individual queries with 1 parallel batch
  const structureIds = useMemo(() => structures.map((s) => s.entityId).filter((id) => id > 0), [structures]);

  const { data: allGuardsMap } = useQuery({
    queryKey: ["guards-batch", structureIds.join(",")],
    queryFn: async () => {
      if (structureIds.length === 0) return new Map<number, Guard[]>();

      // Fetch all guards in parallel
      const results = await Promise.all(
        structureIds.map(async (entityId) => {
          const guards = await sqlApi.fetchGuardsByStructure(entityId);
          return { entityId, guards };
        }),
      );

      // Build a map for O(1) lookup by each item
      const guardsMap = new Map<number, Guard[]>();
      for (const { entityId, guards } of results) {
        guardsMap.set(entityId, guards);
      }
      return guardsMap;
    },
    staleTime: 10000,
    enabled: structureIds.length > 0,
  });

  const sortedStructures = useMemo(() => {
    return [...structures].sort((a, b) => {
      const aRealm = a.structure.base.category === StructureType.Realm ? 1 : 0;
      const bRealm = b.structure.base.category === StructureType.Realm ? 1 : 0;
      if (aRealm !== bRealm) {
        return bRealm - aRealm;
      }
      const nameA = mode.structure.getName(a.structure).name;
      const nameB = mode.structure.getName(b.structure).name;
      return nameA.localeCompare(nameB);
    });
  }, [structures, mode]);

  if (structures.length === 0) {
    return (
      <div className="panel-wood rounded-xl p-6 text-center text-gold/70">
        You do not own any structures capable of creating armies.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sortedStructures.map((realm) => (
        <StructureSelectionItem
          key={realm.entityId}
          realm={realm}
          isSelected={realm.entityId === selectedStructureId}
          inventoryOptions={inventories.get(realm.entityId)}
          guardsData={allGuardsMap?.get(realm.entityId)}
          onSelect={() => onSelect(realm.entityId)}
        />
      ))}
    </div>
  );
};
