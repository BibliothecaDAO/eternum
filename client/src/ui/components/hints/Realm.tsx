import { Headline } from "@/ui/elements/Headline";
import { ResourceCost } from "@/ui/elements/ResourceCost";
import { multiplyByPrecision } from "@/ui/utils/utils";
import { LEVEL_DESCRIPTIONS, REALM_UPGRADE_COSTS, RealmLevels } from "@bibliothecadao/eternum";
import { useMemo } from "react";

export const Realm = () => {
  return (
    <div>
      <Headline>Realm</Headline>
      <h3>Your Realm</h3>
      <p>You have a hex-based realm that you can build on. Each hex can be used to construct buildings.</p>

      <h3>Upgrading to the next level</h3>
      <p>
        As you grow you need more space. Leveling up your Realm enables you to expand into a greater area of the Realm
        allowing more constructions.
      </p>

      <p>Upgrading your realm requires a variety of resources. The cost of upgrading your realm is as follows:</p>

      <LevelTable />
    </div>
  );
};

const LevelTable = () => {
  const levelTable = useMemo(() => {
    return Object.entries(REALM_UPGRADE_COSTS).map(([level, costs]) => ({
      level: RealmLevels[level as keyof typeof RealmLevels],
      cost: costs.map((cost) => ({
        ...cost,
        amount: multiplyByPrecision(cost.amount),
      })),
    }));
  }, []);

  return (
    <table className="not-prose w-full p-2 border-gold/10">
      <thead>
        <tr>
          <th>Level</th>
          <th>Cost</th>
        </tr>
      </thead>
      <tbody>
        {levelTable.map((resource) => (
          <tr className="border border-gold/10" key={resource.level}>
            <td className="p-4">
              <span className="text-2xl">{resource.level}</span>
              <br />
              <span>
                {" "}
                {
                  LEVEL_DESCRIPTIONS[
                    RealmLevels[
                      resource.level as unknown as keyof typeof RealmLevels
                    ] as keyof typeof LEVEL_DESCRIPTIONS
                  ]
                }
              </span>
            </td>
            <td className="gap-1 flex flex-col p-2">
              {resource.cost.length > 0 ? (
                resource.cost.map((cost, index) => (
                  <div key={index}>
                    <ResourceCost resourceId={cost.resource} amount={cost.amount} size="lg" />
                  </div>
                ))
              ) : (
                <div>Starting Level</div>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
