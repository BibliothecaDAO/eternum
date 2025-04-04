import { ETERNUM_CONFIG } from "@/utils/config";
import { findResourceById } from "@/utils/resources";
import { ResourcesIds } from "@/utils/types";
import { formatAmount, formatNumberWithSpaces } from "../utils/formatting";
import ResourceIcon from "./ResourceIcon";

const eternumConfig = ETERNUM_CONFIG();

export default function TroopsTable() {
  const troops = [ResourcesIds.Paladin, ResourcesIds.Knight, ResourcesIds.Crossbowman];
  return (
    <div className="my-4 p-4">
      <div className="font-bold mb-6 text-xl">Military Units</div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {troops.map((troopId) => {
          const resource = findResourceById(troopId);
          const stamina = ETERNUM_CONFIG().troop.troopStaminas[troopId];
          const foodConsumption = ETERNUM_CONFIG().troop.troopFoodConsumption[troopId];

          return (
            <div key={troopId} className="border border-gray-700 p-4 rounded-lg bg-white/5">
              <div className="flex items-center gap-2 mb-4">
                <ResourceIcon size="xl" id={troopId} name={resource?.trait || ""} />
                <span className="text-md font-semibold truncate">{resource?.trait || "Unknown"}</span>
              </div>

              <div className="mb-2 font-bold">
                ⚡️ Stamina: <span className="text-gray-400">{stamina}</span>
              </div>

              <div className="text-sm font-bold mb-2">Food consumed / unit:</div>
              <div className="grid grid-cols-3 gap-2">
                <div className="text-left">
                  <div>Travel</div>
                  <div className="text-gray-400">
                    {formatNumberWithSpaces(Number(formatAmount(foodConsumption.travel_wheat_burn_amount)))}
                  </div>
                  <div className="text-gray-400">
                    {formatNumberWithSpaces(Number(formatAmount(foodConsumption.travel_fish_burn_amount)))}
                  </div>
                </div>

                <div className="text-left">
                  <div>Explore</div>
                  <div className="text-gray-400">
                    {formatNumberWithSpaces(Number(formatAmount(foodConsumption.explore_wheat_burn_amount)))}
                  </div>
                  <div className="text-gray-400">
                    {formatNumberWithSpaces(Number(formatAmount(foodConsumption.explore_fish_burn_amount)))}
                  </div>
                </div>

                <div className="flex flex-col items-center mt-6">
                  <ResourceIcon size="lg" id={ResourcesIds.Wheat} name="Wheat" />
                  <ResourceIcon size="lg" id={ResourcesIds.Fish} name="Fish" />
                </div>
              </div>

              <div className="border-t border-gray-500 my-4"></div>

              <div className="text-sm font-bold mb-2">Stamina Consumed:</div>
              <div className="grid grid-cols-3 gap-2">
                <div className="text-left">
                  <div>Travel</div>
                  <div className="text-gray-400">{formatNumberWithSpaces(eternumConfig.stamina.travelCost)}</div>
                </div>

                <div className="text-left">
                  <div>Explore</div>
                  <div className="text-gray-400">{formatNumberWithSpaces(eternumConfig.stamina.exploreCost)}</div>
                </div>

                <div className="flex justify-center items-center mt-4">
                  <div>⚡️</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
