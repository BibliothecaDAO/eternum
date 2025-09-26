import { sqlApi } from "@/services/api";
import clsx from "clsx";
import { getStructureName, getIsBlitz } from "@bibliothecadao/eternum";
import { useExplorersByStructure } from "@bibliothecadao/react";
import { RealmInfo } from "@bibliothecadao/types";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ChevronRight, Shield, Swords } from "lucide-react";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";

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
  onSelect,
}: {
  realm: RealmInfo;
  isSelected: boolean;
  inventoryOptions: TroopSelectionOption[] | undefined;
  onSelect: () => void;
}) => {
  const explorers = useExplorersByStructure({ structureEntityId: realm.entityId });
  const { data: guardsData } = useQuery({
    queryKey: ["guards", String(realm.entityId)],
    queryFn: async () => {
      if (!realm.entityId) return [];
      const guards = await sqlApi.fetchGuardsByStructure(realm.entityId);
      return guards.filter((guard) => guard.troops?.count && guard.troops.count > 0n);
    },
    staleTime: 10000,
    enabled: realm.entityId > 0,
  });

  const name = getStructureName(realm.structure, getIsBlitz()).name;
  const maxExplorers = realm.structure.base.troop_max_explorer_count || 0;
  const maxGuards = realm.structure.base.troop_max_guard_count || 0;
  const attackCount = explorers.length;
  const defenseCount = guardsData?.length ?? 0;
  const availableTroops =
    inventoryOptions?.flatMap((option) =>
      option.tiers
        .filter((tier) => tier.available > 0)
        .map((tier) => ({
          key: `${option.type}-${tier.tier}`,
          label: `${option.label} T${tier.tier}`,
          available: tier.available,
          resourceTrait: tier.resourceTrait,
        })),
    ) ?? [];

  availableTroops.sort((a, b) => b.available - a.available);
  const topTroops = availableTroops.slice(0, 4);
  const totalTroops = availableTroops.reduce((sum, troop) => sum + troop.available, 0);

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isSelected}
      className={clsx(
        "w-full text-left panel-wood rounded-xl p-4 transition-all duration-200 border-2",
        "hover:border-gold/60 hover:shadow-lg hover:-translate-y-0.5",
        isSelected
          ? "border-gold ring-2 ring-gold/70 shadow-xl shadow-gold/30 bg-gradient-to-br from-gold/20 to-gold/5"
          : "border-brown/30",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-gold text-lg font-bold leading-tight">{name}</h4>
          {isSelected && (
            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gold">
              <CheckCircle2 className="h-3 w-3" /> Selected
            </span>
          )}
        </div>
        <ChevronRight className={clsx("w-5 h-5 transition-transform", isSelected ? "text-gold rotate-90" : "text-gold/60")} />
      </div>

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
              <div
                key={troop.key}
                className="flex items-center justify-between rounded-lg bg-brown/20 px-2 py-1"
              >
                <div className="flex items-center gap-2">
                  <ResourceIcon resource={troop.resourceTrait} size="xs" withTooltip={false} />
                  <span className="text-xs font-semibold text-gold/90">{troop.label}</span>
                </div>
                <span className="text-xs text-gold/70 font-medium">{troop.available.toLocaleString()}</span>
              </div>
            ))}
            {availableTroops.length > topTroops.length && (
              <p className="text-[10px] text-gold/50">+ {availableTroops.length - topTroops.length} more combinations</p>
            )}
          </div>
        ) : (
          <p className="text-xs text-gold/50">No troops currently stored.</p>
        )}
      </div>
    </button>
  );
};

export const StructureSelectionList = ({ structures, selectedStructureId, inventories, onSelect }: StructureSelectionListProps) => {
  if (structures.length === 0) {
    return (
      <div className="panel-wood rounded-xl p-6 text-center text-gold/70">
        You do not own any structures capable of creating armies.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {structures.map((realm) => (
        <StructureSelectionItem
          key={realm.entityId}
          realm={realm}
          isSelected={realm.entityId === selectedStructureId}
          inventoryOptions={inventories.get(realm.entityId)}
          onSelect={() => onSelect(realm.entityId)}
        />
      ))}
    </div>
  );
};
