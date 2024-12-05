import { REALM_UPGRADE_COSTS, RealmLevels, findResourceById } from "@bibliothecadao/eternum";
import { formatNumberWithSpaces } from "../utils/formatting";
import ResourceIcon from "./ResourceIcon";

type Props = {
  level: RealmLevels;
};

export default function RealmUpgradeCosts({ level }: Props) {
  const costs = REALM_UPGRADE_COSTS[level];

  if (costs.length === 0) return null;

  return (
    <div className="my-4 p-3">
      <div className="font-bold mb-2">Upgrade costs:</div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {costs.map((cost) => {
          const resource = findResourceById(cost.resource);
          return (
            <div key={cost.resource} className="flex items-center gap-2 px-3 py-1.5">
              <ResourceIcon size={24} id={cost.resource} name={resource?.trait || ""} />
              <span className="font-medium">{formatNumberWithSpaces(cost.amount)}K</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
