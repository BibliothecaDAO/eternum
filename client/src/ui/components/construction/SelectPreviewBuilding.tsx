import clsx from "clsx";
import { BuildingType } from "@/hooks/store/_buildModeStore";
import useUIStore from "@/hooks/store/useUIStore";

export const SelectPreviewBuilding = () => {
  const { setPreviewBuilding, previewBuilding } = useUIStore();

  const buildingTypes = Object.keys(BuildingType).filter((key) => isNaN(Number(key)) && key !== "Castle");

  const handleSelectBuilding = (buildingType: BuildingType) => {
    setPreviewBuilding(buildingType);
  };

  return (
    <div className="grid grid-cols-3 gap-4 p-2">
      {buildingTypes.map((buildingType, index) => (
        <div
          key={index}
          className={clsx(
            "border border-gold text-gold rounded-md overflow-hidden text-ellipsis p-2 cursor-pointer hover:bg-gold hover:text-brown h-32 w-32",
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
  );
};
