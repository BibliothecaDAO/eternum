import { EternumGlobalConfig, QuestType, findResourceById } from "@bibliothecadao/eternum";
import ResourceIcon from "./ResourceIcon";
import { formatAmount, addSpacesBeforeCapitals } from "../utils/formatting";

export default function QuestRewards() {
  return (
    <div className="grid grid-cols-1 gap-6">
      {Object.entries(EternumGlobalConfig.questResources).map(([questType, rewards]) => (
        <div key={questType} className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/5">
          <div className="font-bold text-lg mb-4">
            {addSpacesBeforeCapitals(QuestType[Number(questType)] || "Unknown Quest")}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {rewards.map((reward, index) => {
              const resource = findResourceById(reward.resource);
              const resourceName = resource?.trait || "Unknown Resource";

              return (
                <div key={index} className="flex items-center px-4 py-2 rounded-md bg-gray-800">
                  <ResourceIcon size="lg" id={reward.resource} name={resourceName} />
                  <span className="font-medium text-gray-300 ml-4">{formatAmount(reward.amount)}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
