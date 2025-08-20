import { useBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { sqlApi } from "@/services/api";
import { getIsBlitz } from "@bibliothecadao/eternum";

import Button from "@/ui/design-system/atoms/button";
import { Headline } from "@/ui/design-system/molecules/headline";
import { HintModalButton } from "@/ui/design-system/molecules/hint-modal-button";
import { HintSection } from "@/ui/features/progression/hints/hint-modal";
import { getStructureName } from "@bibliothecadao/eternum";
import { useDojo, useExplorersByStructure } from "@bibliothecadao/react";
import { Guard } from "@bibliothecadao/torii";
import { ClientComponents, StructureType, Troops } from "@bibliothecadao/types";
import { ComponentValue } from "@dojoengine/recs";
import { useQuery } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ArmyChip } from "./army-chip";
import { StructureDefence } from "./structure-defence";
import { UnifiedArmyCreationModal } from "./unified-army-creation-modal";

export const ArmyList = ({ structure }: { structure: ComponentValue<ClientComponents["Structure"]["schema"]> }) => {
  const dojo = useDojo();
  const setTooltip = useUIStore((state) => state.setTooltip);
  const [guards, setGuards] = useState<Guard[]>([]);

  const explorers = useExplorersByStructure({
    structureEntityId: structure?.entity_id || 0,
  });

  const { currentBlockTimestamp } = useBlockTimestamp();

  const { data: guardsData, isLoading: isLoadingGuards } = useQuery({
    queryKey: ["guards", String(structure?.entity_id)],
    queryFn: async () => {
      if (!structure?.entity_id) return [];
      const guards = await sqlApi.fetchGuardsByStructure(structure.entity_id);
      return guards.filter((guard) => guard.troops?.count && guard.troops.count > 0n);
    },
    staleTime: 10000, // 10 seconds
  });

  useEffect(() => {
    if (guardsData) {
      setGuards(guardsData);
    }
  }, [guardsData]);

  const cooldownSlots = useMemo(() => {
    const slotsTimeLeft: { slot: number; timeLeft: number }[] = [];
    guards.forEach((guard) => {
      if (guard.cooldownEnd > currentBlockTimestamp) {
        slotsTimeLeft.push({ slot: guard.slot, timeLeft: guard.cooldownEnd - currentBlockTimestamp });
      }
    });
    return slotsTimeLeft;
  }, [guards]);

  const totalExplorersCount = useMemo(() => {
    return explorers.length;
  }, [explorers]);

  const isRealmOrVillage = structure.category === StructureType.Realm || structure.category === StructureType.Village;

  const name = useMemo(() => getStructureName(structure, getIsBlitz()).name, [structure]);

  const toggleModal = useUIStore((state) => state.toggleModal);

  const handleCreateAttack = () => {
    toggleModal(<UnifiedArmyCreationModal structureId={structure.entity_id || 0} isExplorer={true} />);
  };

  console.log({ structure, maxDefenseSlots: structure.base.troop_max_guard_count });

  const handleCreateDefense = () => {
    toggleModal(
      <UnifiedArmyCreationModal
        structureId={structure.entity_id || 0}
        isExplorer={false}
        maxDefenseSlots={structure.base.troop_max_guard_count}
      />,
    );
  };

  return (
    <div className="military-panel-selector p-4">
      <Headline>
        <div className="flex items-center gap-3 mb-4">
          <h5>{name}</h5>
          <HintModalButton section={HintSection.Combat} />
        </div>
      </Headline>

      <div className="grid grid-cols-2 gap-4 p-3  rounded-md">
        <div className="text-center">
          <h6>Explorers</h6>
          <h5>
            {totalExplorersCount} / {structure.base.troop_max_explorer_count}
          </h5>
        </div>
        <div className="text-center">
          <h6>Guards</h6>
          <h5>
            {guards.length} / {structure.base.troop_max_guard_count}
          </h5>
        </div>
      </div>

      <div className="space-y-4">
        <Headline>Armies</Headline>

        <div className="flex gap-2 justify-center p-4">
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
              className="px-6 py-2 flex items-center gap-2"
              onClick={handleCreateAttack}
            >
              <PlusIcon className="h-4 w-4" />
              <span>Create Attack</span>
            </Button>
          </div>

          <div
            onMouseEnter={() => {
              if (guards.length >= structure.base.troop_max_guard_count) {
                setTooltip({
                  content: "Maximum number of defenses reached",
                  position: "top",
                });
              }
            }}
            onMouseLeave={() => setTooltip(null)}
          >
            <Button
              variant="outline"
              disabled={guards.length >= structure.base.troop_max_guard_count}
              className="px-6 py-2 flex items-center gap-2"
              onClick={handleCreateDefense}
            >
              <PlusIcon className="h-4 w-4" />
              <span>Create Defense</span>
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          {explorers.map((army) => (
            <ArmyChip key={army.entityId} className="w-full" army={army} showButtons />
          ))}
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <Headline>Defenses</Headline>

        <StructureDefence
          structureId={structure.entity_id || 0}
          maxDefenses={structure.base.troop_max_guard_count}
          troops={guards.map((army) => ({
            slot: army.slot,
            troops: army.troops! as Troops,
          }))}
          cooldownSlots={cooldownSlots}
        />
      </div>
    </div>
  );
};
