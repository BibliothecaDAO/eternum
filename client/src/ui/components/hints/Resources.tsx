import { Headline } from "@/ui/elements/Headline";
import { ResourceCost } from "@/ui/elements/ResourceCost";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import { currencyFormat } from "@/ui/utils/utils";
import {
  RESOURCE_INPUTS_SCALED,
  RESOURCE_OUTPUTS_SCALED,
  ResourcesIds,
  findResourceById,
} from "@bibliothecadao/eternum";
import { useMemo } from "react";

export const Resources = () => {
  const resourceTable = useMemo(() => {
    const resources = [];
    for (const resourceId of Object.keys(RESOURCE_INPUTS_SCALED) as unknown as ResourcesIds[]) {
      const calldata = {
        resource: findResourceById(Number(resourceId)),
        amount: RESOURCE_OUTPUTS_SCALED[resourceId],
        resource_type: resourceId,
        cost: RESOURCE_INPUTS_SCALED[resourceId].map((cost) => {
          return {
            ...cost,
          };
        }),
      };

      resources.push(calldata);
    }

    return resources;
  }, []);
  return (
    <div>
      <Headline>Resources</Headline>
      <h4>Resource Production</h4>
      <p className="my-5">
        All resources except for Food have a resource input cost associated. You must have these resources in your
        balance otherwise production stops. Trade with others or banks in order to keep your balances in check.
      </p>

      <table className="not-prose w-full p-2 border-gold/10">
        <thead>
          <tr>
            <th>Resource</th>
            <th>Production p/s</th>
            <th>Cost p/s</th>
          </tr>
        </thead>
        <tbody>
          {resourceTable.map((resource) => (
            <tr className="border border-gold/10" key={resource.resource_type}>
              <td>
                {" "}
                <ResourceIcon size="xl" resource={resource.resource?.trait || ""} />
              </td>
              <td className="text-xl text-center">{currencyFormat(resource.amount, 0)}</td>
              <td className="gap-1 flex flex-col  p-2">
                {resource.cost.map((cost) => (
                  <div key={cost.amount}>
                    <ResourceCost
                      resourceId={cost.resource}
                      amount={currencyFormat(Number(cost.amount), 0)}
                      size="lg"
                    />
                  </div>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <h4>Storage of Food</h4>
      <p className="my-5">
        You can only store a certain capacity of resources per your storehouses. Each storehouse grants you 10k per
        resource. You can build more storehouses to increase your capacity.
      </p>
    </div>
  );
};
