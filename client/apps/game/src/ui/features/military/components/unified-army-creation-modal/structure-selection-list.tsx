import { sqlApi } from "@/services/api";
import clsx from "clsx";
import { getStructureName, getIsBlitz } from "@bibliothecadao/eternum";
import { useExplorersByStructure } from "@bibliothecadao/react";
import { RealmInfo } from "@bibliothecadao/types";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Shield, Swords } from "lucide-react";

interface StructureSelectionListProps {
  structures: RealmInfo[];
  selectedStructureId: number | null;
  onSelect: (structureId: number) => void;
}

const StructureSelectionItem = ({
  realm,
  isSelected,
  onSelect,
}: {
  realm: RealmInfo;
  isSelected: boolean;
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

  return (
    <button
      type="button"
      onClick={onSelect}
      className={clsx(
        "w-full text-left panel-wood rounded-xl p-4 transition-all duration-200 border-2",
        "hover:border-gold/60 hover:shadow-lg hover:-translate-y-0.5",
        isSelected ? "border-gold ring-1 ring-gold/60 shadow-lg shadow-gold/20" : "border-brown/30",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-gold text-lg font-bold leading-tight">{name}</h4>
          <p className="text-xs text-gold/60">Coords: {realm.structure.base.coord_x}, {realm.structure.base.coord_y}</p>
        </div>
        <ChevronRight className={clsx("w-5 h-5 text-gold transition-transform", isSelected && "rotate-90")} />
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
    </button>
  );
};

export const StructureSelectionList = ({ structures, selectedStructureId, onSelect }: StructureSelectionListProps) => {
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
          onSelect={() => onSelect(realm.entityId)}
        />
      ))}
    </div>
  );
};
