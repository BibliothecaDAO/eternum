import clsx from "clsx";

import useUIStore from "@/hooks/store/useUIStore";
import { BuildingType, ResourceBuildingType, ResourcesIds } from "@bibliothecadao/eternum";

// TODO: THIS IS TERRIBLE CODE, PLEASE REFACTOR

export const SelectPreviewBuilding = () => {
  const { setPreviewBuilding, previewBuilding, selectedResource, setResourceId } = useUIStore();

  const buildingTypes = Object.keys(BuildingType).filter(
    (key) => isNaN(Number(key)) && key !== "Castle" && key !== "None",
  );

  const resources = Object.keys(ResourceBuildingType).filter((key) => isNaN(Number(key)));

  const handleSelectBuilding = (buildingType: BuildingType) => {
    setPreviewBuilding(buildingType);
  };

  return (
    <>
      <div className="grid grid-cols-3 gap-4 p-2">
        {buildingTypes.map((buildingType, index) => (
          <div
            key={index}
            className={clsx(
              "border border-gold text-gold rounded-md overflow-hidden text-ellipsis p-2 cursor-pointer hover:bg-gold hover:text-brown h-16 w-32",
              {
                "bg-gold !text-brown": previewBuilding === BuildingType[buildingType as keyof typeof BuildingType],
              },
            )}
            onClick={() => {
              if (previewBuilding === BuildingType[buildingType as keyof typeof BuildingType]) {
                setPreviewBuilding(null);
              } else {
                handleSelectBuilding(BuildingType[buildingType as keyof typeof BuildingType]);
              }
            }}
          >
            {buildingType}
          </div>
        ))}
      </div>
      <h5 className="w-full  p-2">Resources</h5>
      {previewBuilding == BuildingType.Resource && (
        <div className="grid grid-cols-3 gap-4 p-2">
          {resources.map((resource, index) => (
            <div
              onClick={() => {
                if (selectedResource === ResourcesIds[resource as keyof typeof ResourcesIds]) {
                  setResourceId(null);
                } else {
                  setResourceId(ResourcesIds[resource as keyof typeof ResourcesIds]);
                }
              }}
              className={clsx(
                "border border-gold text-gold rounded-md overflow-hidden text-ellipsis p-2 cursor-pointer hover:bg-gold hover:text-brown h-8 w-32",
                {
                  "bg-gold !text-brown": selectedResource === ResourcesIds[resource as keyof typeof ResourcesIds],
                },
              )}
            >
              {resource}
            </div>
          ))}
        </div>
      )}
    </>
  );
};
