import { Headline } from "@/ui/elements/headline";
import { ResourceCost } from "@/ui/elements/resource-cost";
import { ResourceIcon } from "@/ui/elements/resource-icon";
import { currencyFormat } from "@/ui/utils/utils";
import {
  configManager,
  multiplyByPrecision,
} from "@bibliothecadao/eternum";
import {
  CapacityConfig,
  findResourceById,
  ResourcesIds,
} from "@bibliothecadao/types";
import { useMemo } from "react";

export const Resources = () => {
  return (
    <div className="space-y-8">
      <Headline>Resources</Headline>

      <section className="space-y-4">
        <h4>Resource Production</h4>
        <div className="space-y-4 text-gray-200">
          <p className="leading-relaxed">
            Every resource, with the exception of Food, requires specific inputs for production. Maintaining a
            sufficient balance of these input resources is crucial; if depleted, production will cease. To ensure a
            steady supply, engage in trade with other players or utilize banking services to manage your resource
            equilibrium effectively.
          </p>
          <p className="leading-relaxed">
            Be careful though, if only one of the input resources is depleted, the consumption of the other resources
            will continue.
          </p>
        </div>
        <ResourceTable />
      </section>

      <section className="space-y-4">
        <h4>Storage</h4>
        <div className="space-y-4 text-gray-200">
          <p className="leading-relaxed">
            <span className="font-bold">Storehouses</span> determine your resource storage capacity. Each storehouse
            adds
            <span className="font-bold">
              {` ${configManager.getCapacityConfigKg(CapacityConfig.Storehouse)}Kg capacity`}
            </span>
            . Build more of them to increase storage.
          </p>
        </div>
      </section>
    </div>
  );
};

const ResourceTable = () => {
  const resourceTable = useMemo(() => {
    const resources = [];
    for (const resourceId of Object.keys(configManager.complexSystemResourceInputs) as unknown as ResourcesIds[]) {
      if (resourceId == ResourcesIds.Lords) continue;
      const calldata = {
        resource: findResourceById(Number(resourceId)),
        amount: configManager.getResourceOutputs(resourceId),
        resource_type: resourceId,
        cost: configManager.complexSystemResourceInputs[resourceId].map((cost: any) => ({
          ...cost,
          amount: multiplyByPrecision(cost.amount),
        })),
      };

      resources.push(calldata);
    }

    return resources;
  }, []);

  return (
    <div className="rounded-lg border border-gold/20 overflow-hidden mt-4">
      <table className="not-prose w-full">
        <thead className="bg-gold/5">
          <tr className="border-b border-gold/20">
            <th className="text-left p-4 text-light-pink">Resource</th>
            <th className="text-center p-4 text-light-pink">Production p/s</th>
            <th className="text-left p-4 text-light-pink">Cost p/s</th>
          </tr>
        </thead>
        <tbody>
          {resourceTable.map((resource) => {
            return (
              <tr className="border-b border-gold/10 hover:bg-gold/5 transition-colors" key={resource.resource_type}>
                <td className="p-4">
                  <ResourceIcon size="xl" resource={resource.resource?.trait || ""} />
                </td>
                <td className="text-xl text-center p-4">{currencyFormat(resource.amount, 2)}</td>
                <td className="p-4">
                  <div className="gap-3 flex flex-col">
                    {resource.cost.map((cost, index) => {
                      return (
                        <div key={index}>
                          <ResourceCost
                            resourceId={cost.resource}
                            amount={Number(currencyFormat(Number(cost.amount), 2))}
                            size="lg"
                          />
                        </div>
                      );
                    })}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
