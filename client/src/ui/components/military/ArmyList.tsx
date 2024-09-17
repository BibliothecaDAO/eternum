import { TileManager } from "@/dojo/modelManager/TileManager";
import { useDojo } from "@/hooks/context/DojoContext";
import { useArmiesByEntityOwner } from "@/hooks/helpers/useArmies";
import { type PlayerStructure } from "@/hooks/helpers/useEntities";
import { useQuestStore } from "@/hooks/store/useQuestStore";
import useUIStore from "@/hooks/store/useUIStore";
import { QuestId } from "@/ui/components/quest/questDetails";
import Button from "@/ui/elements/Button";
import { Headline } from "@/ui/elements/Headline";
import { HintModalButton } from "@/ui/elements/HintModalButton";
import { BuildingType, EternumGlobalConfig, StructureType } from "@bibliothecadao/eternum";
import clsx from "clsx";
import { useMemo, useState } from "react";
import { HintSection } from "../hints/HintModal";
import { ArmyChip } from "./ArmyChip";

const MAX_AMOUNT_OF_DEFENSIVE_ARMIES = 1;

enum Loading {
  None,
  CreateDefensive,
  CreateAttacking,
}

export const EntityArmyList = ({ structure }: { structure: PlayerStructure }) => {
  const dojo = useDojo();
  const setTooltip = useUIStore((state) => state.setTooltip);

  const tileManager = new TileManager(dojo.setup, { col: structure.position.x, row: structure.position.y });
  const existingBuildings = tileManager.existingBuildings();

  const { entityArmies: structureArmies } = useArmiesByEntityOwner({
    entity_owner_entity_id: structure?.entity_id || 0,
  });

  const selectedQuest = useQuestStore((state) => state.selectedQuest);

  const {
    account: { account },
    setup: {
      systemCalls: { create_army },
    },
  } = useDojo();

  const [loading, setLoading] = useState<Loading>(Loading.None);

  const maxAmountOfAttackingArmies = useMemo(() => {
    const maxWithBuildings =
      EternumGlobalConfig.troop.baseArmyNumberForStructure +
      existingBuildings.filter(
        (building) =>
          building.category === BuildingType[BuildingType.ArcheryRange] ||
          building.category === BuildingType[BuildingType.Barracks] ||
          building.category === BuildingType[BuildingType.Stable],
      ).length *
        EternumGlobalConfig.troop.armyExtraPerMilitaryBuilding;
    // remove 1 to force to create defensive army first
    const hardMax = EternumGlobalConfig.troop.maxArmiesPerStructure - 1;
    return Math.min(maxWithBuildings, hardMax);
  }, [existingBuildings]);

  const numberAttackingArmies = useMemo(() => {
    return structureArmies.filter((army) => !army.protectee).length;
  }, [structureArmies]);

  const numberDefensiveArmies = useMemo(() => {
    return structureArmies.filter((army) => army.protectee).length;
  }, [structureArmies]);

  const canCreateProtector = useMemo(
    () => numberDefensiveArmies < MAX_AMOUNT_OF_DEFENSIVE_ARMIES,
    [numberDefensiveArmies],
  );

  const isRealm = structure.category === StructureType[StructureType.Realm];

  const handleCreateArmy = (is_defensive_army: boolean) => {
    if (!structure.entity_id) throw new Error("Structure's entity id is undefined");
    setLoading(is_defensive_army ? Loading.CreateDefensive : Loading.CreateAttacking);
    create_army({
      signer: account,
      army_owner_id: structure.entity_id,
      is_defensive_army,
    }).finally(() => {
      setLoading(Loading.None);
    });
  };
  return (
    <div className="p-2">
      <Headline className="my-3">
        <div className="flex gap-2">
          <div className="self-center">{structure.name} </div>
          <HintModalButton section={HintSection.Buildings} />
        </div>
      </Headline>
      <div className="px-3 py-2 bg-blueish/20  font-bold">
        Your Realm can only ever have {EternumGlobalConfig.troop.maxArmiesPerStructure - 1} armies. You can increase
        your current max number of armies by building military buildings.
      </div>
      <div className="flex justify-between">
        <div
          className={`mt-2 font-bold ${numberAttackingArmies < maxAmountOfAttackingArmies ? "text-green" : "text-red"}`}
        >
          {numberAttackingArmies} / {maxAmountOfAttackingArmies} attacking armies
        </div>
        <div
          className={`mt-2 font-bold ${
            numberDefensiveArmies < MAX_AMOUNT_OF_DEFENSIVE_ARMIES ? "text-green" : "text-red"
          }`}
        >
          {numberDefensiveArmies} / {MAX_AMOUNT_OF_DEFENSIVE_ARMIES} defending army
        </div>
      </div>
      <div className="w-full flex justify-between my-4">
        <div
          onMouseEnter={() => {
            if (!isRealm) {
              setTooltip({
                content: "Can only create attacking armies on realms",
                position: "top",
              });
            }
          }}
          onMouseLeave={() => {
            setTooltip(null);
          }}
        >
          <Button
            isLoading={loading === Loading.CreateAttacking}
            variant="primary"
            onClick={() => {
              handleCreateArmy(false);
            }}
            disabled={loading !== Loading.None || numberAttackingArmies >= maxAmountOfAttackingArmies || !isRealm}
            className={clsx({
              "animate-pulse": selectedQuest?.id === QuestId.CreateArmy,
            })}
          >
            Create attacking Army
          </Button>
        </div>

        <Button
          isLoading={loading === Loading.CreateDefensive}
          variant="primary"
          onClick={() => {
            handleCreateArmy(true);
          }}
          disabled={loading !== Loading.None || !canCreateProtector}
        >
          Create Defense Army
        </Button>
      </div>
      {structureArmies.map((army) => (
        <ArmyChip className="my-2" army={army} showButtons />
      ))}
    </div>
  );
};
