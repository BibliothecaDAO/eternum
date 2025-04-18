import { ETERNUM_CONFIG } from "@/utils/config";
import { findResourceById } from "@/utils/resources";
import { RealmLevels } from "@bibliothecadao/types";
import { formatAmount } from "../utils/formatting";
import ResourceIcon from "./ResourceIcon";

type Props = {
  level: RealmLevels;
  description: string;
};

export default function RealmUpgradeCosts({ level, description }: Props) {
  const config = ETERNUM_CONFIG();
  const realmUpgradeCosts = config.realmUpgradeCosts[level];

  return (
    <div className="p-6 mb-6 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/5">
      <h4 className="text-lg font-bold mb-4">{description}</h4>
      {realmUpgradeCosts.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {realmUpgradeCosts.map((cost) => {
            const resource = findResourceById(cost.resource);
            return (
              <div key={cost.resource} className="flex items-center gap-2 rounded-md">
                <ResourceIcon size="lg" id={cost.resource} name={resource?.trait || ""} />
                <div className="flex flex-col">
                  <span className="font-medium">{resource?.trait}</span>
                  <span className="font-medium">{formatAmount(cost.amount)}</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-white">Your starting realm.</p>
      )}
    </div>
  );
}
