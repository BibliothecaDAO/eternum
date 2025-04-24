import { ReactComponent as ArrowRight } from "@/assets/icons/common/arrow-right.svg";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { BUILDING_IMAGES_PATH } from "@/ui/config";
import Button from "@/ui/elements/button";
import { ResourceIcon } from "@/ui/elements/resource-icon";
import { getEntityIdFromKeys, getRealmInfo, TileManager, toHexString } from "@bibliothecadao/eternum";
import { Building, isFoodBuilding, isMilitaryBuilding, isResourceBuilding, ResourcesIds } from "@bibliothecadao/types";
import { useBuildings, useDojo } from "@bibliothecadao/react";
import clsx from "clsx";
import { useMemo, useState } from "react";

export const Buildings = ({ structure }: { structure: any }) => {
  const dojo = useDojo();

  const structureEntityId = useUIStore((state) => state.structureEntityId);

  const [showEconomy, setShowEconomy] = useState(false);
  const [showResource, setShowResource] = useState(false);
  const [showMilitary, setShowMilitary] = useState(false);
  const [isLoading, setIsLoading] = useState({ isLoading: false, innerCol: 0, innerRow: 0 });

  const realm = useMemo(
    () => getRealmInfo(getEntityIdFromKeys([BigInt(structureEntityId)]), dojo.setup.components),
    [structureEntityId, dojo.setup.components],
  );

  const buildings = useBuildings(realm?.position.x || 0, realm?.position.y || 0);

  const foodBuildings = buildings.filter((building) => isFoodBuilding(building.category));

  const resourceBuildings = buildings.filter((building) => isResourceBuilding(building.category));

  const militaryBuildings = buildings.filter((building) => isMilitaryBuilding(building.category));

  const handlePauseResumeProduction = (paused: boolean, innerCol: number, innerRow: number) => {
    setIsLoading({ isLoading: true, innerCol, innerRow });
    const tileManager = new TileManager(dojo.setup.components, dojo.setup.systemCalls, {
      col: structure.position!.x,
      row: structure.position!.y,
    });

    const action = paused ? tileManager.resumeProduction : tileManager.pauseProduction;
    action(dojo.account.account, structureEntityId, innerCol, innerRow).then(() => {
      setIsLoading({ isLoading: false, innerCol, innerRow });
    });
  };

  if (!realm) return null;
  const isOwner = toHexString(realm.owner) === dojo.account.account.address;

  return (
    <div className="buildings-selector w-full text-sm p-3">
      {/* Economy Section */}
      <div className="mb-4">
        <div
          className={clsx("economy-building-selector flex items-center cursor-pointer mb-2", {
            "pointer-events-none opacity-50": !foodBuildings.length,
          })}
          onClick={() => setShowEconomy(!showEconomy)}
        >
          <div className="text-lg font-bold">Economy</div>
          <span className="ml-2">
            <ArrowRight className={`w-2 fill-gold transform transition-transform ${showEconomy ? "rotate-90" : ""}`} />
          </span>
        </div>

        {showEconomy &&
          foodBuildings.map((building, index) => (
            <BuildingRow
              key={`economy-${index}`}
              building={building}
              isOwner={isOwner}
              isLoading={isLoading}
              handlePauseResumeProduction={handlePauseResumeProduction}
            />
          ))}
      </div>

      {/* Resource Section */}
      <div className="mb-4">
        <div
          className={clsx("flex items-center cursor-pointer mb-2", {
            "pointer-events-none opacity-50": !resourceBuildings.length,
          })}
          onClick={() => setShowResource(!showResource)}
        >
          <div className="text-lg font-bold">Resource</div>
          <span className="ml-2">
            <ArrowRight className={`w-2 fill-gold transform transition-transform ${showResource ? "rotate-90" : ""}`} />
          </span>
        </div>
        {showResource &&
          resourceBuildings.map((building, index) => (
            <BuildingRow
              key={`resource-${index}`}
              building={building}
              isOwner={isOwner}
              isLoading={isLoading}
              handlePauseResumeProduction={handlePauseResumeProduction}
            />
          ))}
      </div>

      {/* Military Section */}
      <div className="mb-4">
        <div
          className={clsx("flex items-center cursor-pointer mb-2", {
            "pointer-events-none opacity-50": !militaryBuildings.length,
          })}
          onClick={() => {
            setShowMilitary(!showMilitary);
          }}
        >
          <div className="text-lg font-bold">Military</div>
          <span className="ml-2">
            <ArrowRight className={`w-2 fill-gold transform transition-transform ${showMilitary ? "rotate-90" : ""}`} />
          </span>
        </div>
        {showMilitary &&
          militaryBuildings.map((building, index) => (
            <BuildingRow
              key={`military-${index}`}
              building={building}
              isOwner={isOwner}
              isLoading={isLoading}
              handlePauseResumeProduction={handlePauseResumeProduction}
            />
          ))}
      </div>
    </div>
  );
};

const BuildingsHeader = () => {
  return (
    <div className="grid grid-cols-3 gap-2 mb-4 text-xs text-gold tracking-wider uppercase">
      <div className=""></div>
      <div className="text-center">Produces /s</div>
      <div className="text-center">Consumes /s</div>
    </div>
  );
};

interface BuildingRowProps {
  building: Building;
  isOwner: boolean;
  isLoading: { isLoading: boolean; innerCol: number; innerRow: number };
  handlePauseResumeProduction: (paused: boolean, innerCol: number, innerRow: number) => void;
}
const BuildingRow = ({ building, isOwner, isLoading, handlePauseResumeProduction }: BuildingRowProps) => {
  return (
    <div className="flex flex-col p-2 mb-4 text-md rounded transition-colors border border-gold/10">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center space-x-3">
          <img
            className="w-24 bg-brown/40 rounded-xl p-1"
            src={BUILDING_IMAGES_PATH[building.category as keyof typeof BUILDING_IMAGES_PATH]}
          />
          <h4 className="text-lg font-medium">{building.name}</h4>
        </div>

        {isOwner && (
          <Button
            onClick={() => handlePauseResumeProduction(building.paused, building.innerCol, building.innerRow)}
            isLoading={
              isLoading.isLoading &&
              isLoading.innerCol === building.innerCol &&
              isLoading.innerRow === building.innerRow
            }
            variant="outline"
            withoutSound
            className="pause-building-button-selector"
          >
            {building.paused ? "Resume Production" : "Pause Production"}
          </Button>
        )}
      </div>

      {!building.paused && (
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <p className="text-green font-medium">
              +{(building.produced.amount * (1 + building.bonusPercent / 10000)).toFixed(1)}
            </p>
            <ResourceIcon resource={ResourcesIds[building.produced.resource]} size={"sm"} />
            {building.bonusPercent !== 0 && <p className="text-green text-sm">(+{building.bonusPercent / 100}%)</p>}
          </div>

          <div className="flex items-center space-x-4">
            {building.consumed.map((resource, index) => (
              <div key={index} className="flex items-center space-x-1">
                <p className="text-light-red font-medium">-{resource.amount}</p>
                <ResourceIcon resource={ResourcesIds[resource.resource]} size={"sm"} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
