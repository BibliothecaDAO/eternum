import { REALM_UPGRADE_COSTS, RealmLevels, findResourceById } from "@bibliothecadao/eternum";
import ResourceIcon from "./ResourceIcon";

type Props = {
  level: RealmLevels;
  description: string;
};

export default function RealmUpgradeCosts({ level, description }: Props) {
  const costs = REALM_UPGRADE_COSTS[level] || [];

  const formatAmount = (amount: number) => {
    if (amount < 1000) {
      return `${amount}K`;
    } else {
      return `${Math.floor(amount / 1000)}M`;
    }
  };

  return (
    <div className="p-6 mb-6 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/5">
      <h4 className="text-xl font-bold mb-4">{description}</h4>
      {costs.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {costs.map((cost) => {
            const resource = findResourceById(cost.resource);
            return (
              <div
                key={cost.resource}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-gray-100 dark:bg-gray-800"
              >
                <ResourceIcon size={24} id={cost.resource} name={resource?.trait || ""} />
                <span className="font-medium">{formatAmount(cost.amount)}</span>
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
