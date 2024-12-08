import { TROOPS_STAMINAS, TROOPS_FOOD_CONSUMPTION, ResourcesIds, findResourceById } from "@bibliothecadao/eternum";
import ResourceIcon from "./ResourceIcon";
import { formatNumberWithSpaces } from "../utils/formatting";

type TroopId = keyof typeof TROOPS_STAMINAS;

export default function TroopsTable() {
  const troops = [ResourcesIds.Paladin, ResourcesIds.Knight, ResourcesIds.Crossbowman];

  return (
    <div className="my-2 p-2">
      <div className="font-bold mb-4 text-xl">Military Units</div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {troops.map((troopId) => {
          const resource = findResourceById(troopId);
          const stamina = TROOPS_STAMINAS[troopId as TroopId];
          const foodConsumption = TROOPS_FOOD_CONSUMPTION[troopId as TroopId];

          return (
            <div key={troopId} className="border border-gray-700 p-4 rounded-lg">
              <div className="flex items-center gap-3 mb-3">
                <ResourceIcon size={48} id={troopId} name={resource?.trait || ""} />
                <span className="text-lg font-semibold truncate w-full max-w-[150px]">
                  {resource?.trait || "Unknown"}
                </span>
              </div>

              <div className="mb-3">
                <div className="font-bold">Stamina:</div>
                <div>{stamina}</div>
              </div>

              <div>
                <div className="font-bold mb-1">Food Consumption:</div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2">
                    <ResourceIcon size={24} id={ResourcesIds.Wheat} name="Wheat" />
                    <span>Explore: {formatNumberWithSpaces(foodConsumption.explore_wheat_burn_amount)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ResourceIcon size={24} id={ResourcesIds.Fish} name="Fish" />
                    <span>Explore: {formatNumberWithSpaces(foodConsumption.explore_fish_burn_amount)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ResourceIcon size={24} id={ResourcesIds.Wheat} name="Wheat" />
                    <span>Travel: {formatNumberWithSpaces(foodConsumption.travel_wheat_burn_amount)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ResourceIcon size={24} id={ResourcesIds.Fish} name="Fish" />
                    <span>Travel: {formatNumberWithSpaces(foodConsumption.travel_fish_burn_amount)}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
