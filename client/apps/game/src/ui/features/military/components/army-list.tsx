import { useUIStore } from "@/hooks/store/use-ui-store";
import { sqlApi } from "@/services/api";

import Button from "@/ui/design-system/atoms/button";
import { useExplorersByStructure } from "@bibliothecadao/react";
import { Guard } from "@bibliothecadao/torii";
import { ClientComponents, StructureType, Troops } from "@bibliothecadao/types";
import { ComponentValue } from "@dojoengine/recs";
import { useQuery } from "@tanstack/react-query";
import { Shield, Sword } from "lucide-react";
import { useMemo } from "react";
import { ArmyChip } from "./army-chip";
import { CompactDefenseDisplay } from "./compact-defense-display";

export const ArmyList = ({ structure }: { structure: ComponentValue<ClientComponents["Structure"]["schema"]> }) => {
  const setTooltip = useUIStore((state) => state.setTooltip);
  const structureId = Number(structure?.entity_id ?? 0);

  const explorers = useExplorersByStructure({
    structureEntityId: structureId,
  });

  const { data: guardsData } = useQuery({
    queryKey: ["guards", String(structureId)],
    queryFn: async () => {
      if (!structureId) return [];
      return await sqlApi.fetchGuardsByStructure(structureId);
    },
    staleTime: 10000, // 10 seconds
  });

  const guards = useMemo<Guard[]>(() => {
    return (guardsData ?? []).map((guard) => ({
      ...guard,
      troops: guard.troops ?? { category: null, tier: null, count: 0n, stamina: { amount: 0n, updated_tick: 0n } },
    }));
  }, [guardsData]);

  const nonEmptyGuardCount = useMemo(
    () => guards.filter((guard) => guard.troops?.count && guard.troops.count > 0n).length,
    [guards],
  );

  const totalExplorersCount = explorers.length;

  const isRealmOrVillage = structure.category === StructureType.Realm || structure.category === StructureType.Village;

  const maxGuardSlots = structure.base.troop_max_guard_count;
  const isDefenseFull = guards.length >= maxGuardSlots;
  const hasExistingGuards = guards.length > 0;
  const canOpenDefenseModal = !isDefenseFull || hasExistingGuards;

  const openArmyCreationPopup = useUIStore((state) => state.openArmyCreationPopup);

  const handleCreateAttack = () => {
    openArmyCreationPopup({
      structureId,
      isExplorer: true,
    });
  };

  const handleCreateDefense = () => {
    openArmyCreationPopup({
      structureId,
      isExplorer: false,
      maxDefenseSlots: structure.base.troop_max_guard_count,
    });
  };

  return (
    <div className="military-panel-selector p-3 space-y-3">
      <div className="grid grid-cols-2 gap-2 rounded-md border border-gold/15 bg-black/40 p-2 text-center">
        <div>
          <div className="text-xxs uppercase tracking-[0.12em] text-gold/60">Attack Armies</div>
          <div className="text-sm font-semibold text-gold">
            {totalExplorersCount} / {structure.base.troop_max_explorer_count}
          </div>
        </div>
        <div>
          <div className="text-xxs uppercase tracking-[0.12em] text-gold/60">Guard Armies</div>
          <div className="text-sm font-semibold text-gold">
            {nonEmptyGuardCount} / {structure.base.troop_max_guard_count}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex gap-2 justify-center">
          <div
            onMouseEnter={() => {
              if (!isRealmOrVillage) {
                setTooltip({
                  content: "Can only create attacking armies on realms",
                  position: "top",
                });
              } else if (totalExplorersCount >= structure.base.troop_max_explorer_count) {
                setTooltip({
                  content: "Maximum number of armies reached",
                  position: "top",
                });
              }
            }}
            onMouseLeave={() => setTooltip(null)}
          >
            <Button
              variant="primary"
              disabled={!isRealmOrVillage || totalExplorersCount >= structure.base.troop_max_explorer_count}
              className="px-3 py-2 flex items-center gap-2"
              onClick={handleCreateAttack}
              aria-label="Create attack army"
              title="Create attack army"
            >
              <Sword className="h-4 w-4" />
            </Button>
          </div>

          <div
            onMouseEnter={() => {
              if (!canOpenDefenseModal) {
                setTooltip({
                  content: "This structure does not have available defense slots",
                  position: "top",
                });
              } else if (isDefenseFull) {
                setTooltip({
                  content: "All defense slots are filled. Reinforce or remove an existing defense.",
                  position: "top",
                });
              }
            }}
            onMouseLeave={() => setTooltip(null)}
          >
            <Button
              variant="outline"
              disabled={!canOpenDefenseModal}
              className="px-3 py-2 flex items-center gap-2"
              onClick={handleCreateDefense}
              aria-label="Create defense army"
              title="Create defense army"
            >
              <Shield className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between text-xxs uppercase tracking-[0.12em] text-gold/60">
            <span>Defenses</span>
            <span className="text-gold/70">
              {nonEmptyGuardCount}/{structure.base.troop_max_guard_count}
            </span>
          </div>

          <CompactDefenseDisplay
            className="w-full"
            slotsUsed={nonEmptyGuardCount}
            slotsMax={structure.base.troop_max_guard_count}
            structureId={structureId}
            canManageDefense={canOpenDefenseModal}
            troops={guards.map((army) => ({
              slot: army.slot,
              troops: army.troops as Troops,
            }))}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xxs uppercase tracking-[0.12em] text-gold/60">
            <span>Attack Armies</span>
            <span className="text-gold/70">
              {totalExplorersCount}/{structure.base.troop_max_explorer_count}
            </span>
          </div>
          {explorers.map((army) => (
            <ArmyChip key={army.entityId} className="w-full" army={army} showButtons />
          ))}
        </div>
      </div>
    </div>
  );
};
