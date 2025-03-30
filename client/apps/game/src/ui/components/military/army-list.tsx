import { useBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { HintSection } from "@/ui/components/hints/hint-modal";
import { ArmyChip } from "@/ui/components/military/army-chip";
import { ArmyCreate } from "@/ui/components/military/army-management-card";
import Button from "@/ui/elements/button";
import { Headline } from "@/ui/elements/headline";
import { HintModalButton } from "@/ui/elements/hint-modal-button";
import { ArmyManager, ClientComponents, getEntityName, StructureType } from "@bibliothecadao/eternum";
import { useDojo, useExplorersByStructure, useGuardsByStructure } from "@bibliothecadao/react";
import { ComponentValue } from "@dojoengine/recs";
import { PlusIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { StructureDefence } from "./structure-defence";

export const EntityArmyList = ({
  structure,
}: {
  structure: ComponentValue<ClientComponents["Structure"]["schema"]>;
}) => {
  const dojo = useDojo();
  const setTooltip = useUIStore((state) => state.setTooltip);

  const explorers = useExplorersByStructure({
    structureEntityId: structure?.entity_id || 0,
  });

  const guards = useGuardsByStructure({
    structureEntityId: structure?.entity_id || 0,
  });

  const { currentBlockTimestamp } = useBlockTimestamp();

  const cooldownSlots = useMemo(() => {
    const slotsTimeLeft: { slot: number; timeLeft: number }[] = [];
    guards.forEach((guard) => {
      if (guard.cooldownEnd > currentBlockTimestamp) {
        slotsTimeLeft.push({ slot: guard.slot, timeLeft: guard.cooldownEnd - currentBlockTimestamp });
      }
    });
    return slotsTimeLeft;
  }, [guards]);

  const [showTroopSelection, setShowTroopSelection] = useState<boolean>(false);

  const totalExplorersCount = useMemo(() => {
    return explorers.length;
  }, [explorers]);

  const totalGuards = useMemo(() => {
    return guards.filter((guard) => guard.troops.count > 0n).length;
  }, [guards]);

  const isRealmOrVillage = structure.category === StructureType.Realm || structure.category === StructureType.Village;

  const armyManager = useMemo(() => {
    if (!structure.entity_id) return null;
    return new ArmyManager(dojo.setup.systemCalls, dojo.setup.components, structure.entity_id);
  }, [structure.entity_id, dojo.setup.systemCalls, dojo.setup.components]);

  const name = useMemo(
    () => getEntityName(structure.entity_id, dojo.setup.components),
    [structure.entity_id, dojo.setup.components],
  );

  return (
    <div className="military-panel-selector p-4 bg-brown/90 rounded-lg">
      <Headline>
        <div className="flex items-center gap-3 mb-4">
          <div className="text-xl font-bold text-gold">{name}</div>
          <HintModalButton section={HintSection.Combat} />
        </div>
      </Headline>

      <div className="grid grid-cols-2 gap-4 p-3 bg-brown/90 rounded-md">
        <div className="text-center">
          <div className="text-sm text-gold">Explorers</div>
          <div className="text-lg font-bold text-gold/90">
            {totalExplorersCount} / {structure.base.troop_max_explorer_count}
          </div>
        </div>
        <div className="text-center">
          <div className="text-sm text-gold">Guards</div>
          <div className="text-lg font-bold text-gold/90">
            {totalGuards} / {structure.base.troop_max_guard_count}
          </div>
        </div>
      </div>

      <div className="">
        {showTroopSelection && armyManager ? (
          <div className="border-2 border-gold/50 rounded-lg p-4">
            <ArmyCreate
              owner_entity={structure.entity_id || 0}
              army={undefined}
              armyManager={armyManager}
              isExplorer={true}
              onCancel={() => setShowTroopSelection(false)}
            />
          </div>
        ) : (
          <div
            className="flex justify-center items-center p-4"
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
              className="attack-army-selector px-6 py-2 text-lg flex items-center gap-2"
              onClick={() => setShowTroopSelection(true)}
            >
              <PlusIcon className="h-5 w-5" />
              <span>Create Attack Army</span>
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <Headline>
          <div className="flex items-center gap-3">
            <div className="text-lg font-bold text-gold">Armies</div>
          </div>
        </Headline>

        <div className="space-y-3">
          {explorers.map((army) => (
            <ArmyChip key={army.entityId} className="w-full" army={army} showButtons />
          ))}
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <Headline>
          <div className="flex items-center gap-3">
            <div className="text-lg font-bold text-gold">Structure Defenses</div>
          </div>
        </Headline>

        <StructureDefence
          structureId={structure.entity_id || 0}
          maxDefenses={structure.base.troop_max_guard_count}
          troops={guards.map((army) => ({
            slot: army.slot,
            troops: army.troops,
          }))}
          cooldownSlots={cooldownSlots}
        />
      </div>
    </div>
  );
};
