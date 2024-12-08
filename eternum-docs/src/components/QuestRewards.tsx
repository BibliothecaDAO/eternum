import { EternumGlobalConfig, QuestType } from "@bibliothecadao/eternum";
import { formatNumberWithSpaces } from "../utils/formatting";
import ResourceIcon from "./ResourceIcon";

function addSpacesBeforeCapitals(str: string): string {
  return str.replace(/([A-Z])/g, " $1").trim();
}

export default function QuestRewards() {
  return (
    <>
      {Object.entries(EternumGlobalConfig.questResources).map(([questType, rewards], index) => {
        return (
          <div className="my-4 p-3 " key={index}>
            <div className="font-bold mb-2">{addSpacesBeforeCapitals(QuestType[Number(questType)])}</div>
            <div className="grid grid-cols-6 gap-2">
              {rewards.map((cost, index) => {
                return (
                  <div key={index} className="flex items-center gap-1 px-2 py-1.5 rounded-md">
                    <ResourceIcon size={24} id={cost.resource} name="" />
                    <span className="font-medium">{formatNumberWithSpaces(cost.amount)}K</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}
