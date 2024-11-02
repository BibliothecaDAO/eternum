import { ClientComponents } from "@/dojo/createClientComponents";
import { TileManager } from "@/dojo/modelManager/TileManager";
import { configManager } from "@/dojo/setup";
import { useDojo } from "@/hooks/context/DojoContext";
import { useGetRealm } from "@/hooks/helpers/useRealm";
import useUIStore from "@/hooks/store/useUIStore";
import Button from "@/ui/elements/Button";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import { ResourceIdToMiningType } from "@/ui/utils/utils";
import { BuildingType, ResourcesIds } from "@bibliothecadao/eternum";
import { useComponentValue } from "@dojoengine/react";
import { Component, Has, HasValue, runQuery } from "@dojoengine/recs";
import { capitalize } from "lodash";
import { useState } from "react";

export const Buildings = ({ structure }: { structure: any }) => {
  const dojo = useDojo();

  const structureEntityId = useUIStore((state) => state.structureEntityId);

  const [isLoading, setIsLoading] = useState(false);

  const realm = useGetRealm(structureEntityId).realm;

  const buildingEntities = runQuery([
    Has(dojo.setup.components.Building),
    HasValue(dojo.setup.components.Building, { outer_col: realm.position.x, outer_row: realm.position.y }),
  ]);

  const handlePauseResumeProduction = (paused: boolean, innerCol: number, innerRow: number) => {
    setIsLoading(true);
    const tileManager = new TileManager(dojo.setup, {
      col: structure.position!.x,
      row: structure.position!.y,
    });

    const action = paused ? tileManager.resumeProduction : tileManager.pauseProduction;
    action(innerCol, innerRow).then(() => {
      setIsLoading(false);
    });
  };

  return (
    <div className="w-full text-sm p-3">
      <BuildingsHeader />

      {Array.from(buildingEntities).map((entity, index) => (
        <BuildingRow
          key={index}
          buildingEntity={entity}
          handlePauseResumeProduction={handlePauseResumeProduction}
          isLoading={isLoading}
          Building={dojo.setup.components.Building}
        />
      ))}
    </div>
  );
};

const BuildingsHeader = () => {
  return (
    <div className="flex grid grid-cols-7 gap-2 mb-4 uppercase text-xs font-bold border-b-2 ">
      <div className="col-span-2">Type</div>
      <div className="col-span-2">Produces /s</div>
      <div className="col-span-2 text-center">Consumes /s</div>
      <></>
    </div>
  );
};

interface BuildingRowProps {
  buildingEntity: any;
  isLoading: boolean;
  handlePauseResumeProduction: (paused: boolean, innerCol: number, innerRow: number) => void;
  Building: Component<ClientComponents["Building"]["schema"]>;
}
const BuildingRow = ({ buildingEntity, handlePauseResumeProduction, isLoading, Building }: BuildingRowProps) => {
  const building = useComponentValue(Building, buildingEntity);
  if (!building || !building.produced_resource_type) return;

  const produced = configManager.resourceOutput[building.produced_resource_type];
  const consumed = configManager.resourceInputs[building.produced_resource_type];

  let buildingName = building.category;

  // Add spaces before capital letters (except at the start of the string)
  buildingName = buildingName.replace(/([a-z])([A-Z])/g, "$1 $2");

  if (building.category === BuildingType[BuildingType.Resource]) {
    buildingName = ResourcesIds[building.produced_resource_type] + " ";

    if (building.produced_resource_type != ResourcesIds.Dragonhide) {
      buildingName += capitalize(ResourceIdToMiningType[building.produced_resource_type as ResourcesIds]);
    }

    // Replace underscores with spaces
    buildingName = buildingName.replace(/_/g, " ");
  }

  return (
    <div className="flex grid grid-cols-7 gap-2 p-1 text-md items-center border-b">
      <p className="col-span-2">{buildingName}</p>

      <div className="flex flex-row col-span-2">
        {!building.paused && (
          <>
            <p className="text-green/80">+{(produced.amount * (1 + building.bonus_percent / 10000)).toFixed(1)}</p>
            <ResourceIcon resource={ResourcesIds[produced.resource]} size={"sm"} />
            {building.bonus_percent !== 0 && <p className="ml-2 text-green">(+{building.bonus_percent / 100}%)</p>}
          </>
        )}
      </div>

      <div className="col-span-2">
        {!building.paused &&
          consumed.map((resource, index) => {
            return (
              <div key={index} className="flex flex-row justify-center">
                <p className="text-light-red">-{resource.amount}</p>
                <ResourceIcon resource={ResourcesIds[resource.resource]} size={"sm"} />
              </div>
            );
          })}
      </div>

      <div>
        <Button
          onClick={() => {
            handlePauseResumeProduction(building.paused, building.inner_col, building.inner_row);
          }}
          isLoading={isLoading}
          variant="outline"
          withoutSound
        >
          {building.paused ? "Resume" : "Pause"}
        </Button>
      </div>
    </div>
  );
};
