import {
  TROOPS_STAMINAS,
  TROOPS_FOOD_CONSUMPTION,
  ResourcesIds,
  findResourceById,
  EternumGlobalConfig,
} from "@bibliothecadao/eternum";
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
            <div key={troopId} className="border border-gray-700 p-4 rounded-lg bg-white/5">
              <div className="flex items-center gap-3 mb-3">
                <ResourceIcon size="lg" id={troopId} name={resource?.trait || ""} />
                <span className="text-lg font-semibold truncate w-full max-w-[150px]">
                  {resource?.trait || "Unknown"}
                </span>
              </div>

              <div className="mb-3">
                <div className="font-bold">⚡️ Stamina:</div>
                <div className="text-gray-400">{stamina}</div>
              </div>

              <div className="grid grid-cols-5 gap-2 font-bold">
                <span className="col-span-2">Travel</span>
                <span className="col-span-2">Explore</span>
                <div></div>
              </div>
              <div className="text-xs font-bold mb-1">Food consumed / unit:</div>
              <div>
                <div className="grid grid-cols-5 gap-2">
                  <div className="col-span-2 text-gray-400">
                    {formatNumberWithSpaces(foodConsumption.travel_wheat_burn_amount)}
                  </div>
                  <div className="col-span-2 text-gray-400">
                    {formatNumberWithSpaces(foodConsumption.explore_wheat_burn_amount)}
                  </div>
                  <ResourceIcon size="lg" id={ResourcesIds.Wheat} name="Wheat" />

                  <div className="col-span-2 text-gray-400">
                    {formatNumberWithSpaces(foodConsumption.travel_fish_burn_amount)}
                  </div>
                  <div className="col-span-2 text-gray-400">
                    {formatNumberWithSpaces(foodConsumption.explore_fish_burn_amount)}
                  </div>
                  <ResourceIcon size="lg" id={ResourcesIds.Fish} name="Fish" />
                </div>
              </div>
              <div className="text-xs font-bold mb-1">Stamina Consumed:</div>
              <div className="grid grid-cols-5 gap-2">
                <div className="col-span-2 text-gray-400">
                  {formatNumberWithSpaces(EternumGlobalConfig.stamina.travelCost)}
                </div>
                <div className="col-span-2 text-gray-400">
                  {formatNumberWithSpaces(EternumGlobalConfig.stamina.exploreCost)}
                </div>
                <div>⚡️</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
