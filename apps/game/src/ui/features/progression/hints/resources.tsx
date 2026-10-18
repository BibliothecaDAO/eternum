import { Headline } from "@/ui/design-system/molecules/headline";
import { ResourceCost } from "@/ui/design-system/molecules/resource-cost";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { currencyFormat } from "@/ui/utils/utils";
import { configManager, multiplyByPrecision } from "@bibliothecadao/eternum";
import { CapacityConfig, findResourceById, ResourcesIds } from "@bibliothecadao/types";
import { useMemo } from "react";

import { ReferenceTable } from "./article";

export const Resources = () => {
  return (
    <div className="space-y-8">
      <Headline>Resources</Headline>

      <section className="space-y-4">
        <h4>Resource Production</h4>
        <div className="space-y-4">
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
        <div className="space-y-4">
          <p className="leading-relaxed">
            <strong>Storehouses</strong> determine your resource storage capacity. Each storehouse adds
            <strong>{` ${configManager.getCapacityConfigKg(CapacityConfig.Storehouse)}Kg capacity`}</strong>. Build more
            of them to increase storage.
          </p>
        </div>
      </section>
    </div>
  );
};

const ResourceTable = () => {
  const resourceTable = useMemo(() => {
    const resources = [];
    for (const resourceId of configManager.producibleResources()) {
      if (resourceId == ResourcesIds.Lords) continue;
      const calldata = {
        resource: findResourceById(Number(resourceId)),
        amount: configManager.getResourceOutputs(resourceId),
        resource_type: resourceId,
        cost: configManager.getRecipeInputs(resourceId, false)!.map((cost) => ({
          ...cost,
          amount: multiplyByPrecision(cost.amount),
        })),
      };

      resources.push(calldata);
    }

    return resources;
  }, []);

  return (
    <ReferenceTable
      label="What each resource makes and costs per second"
      cols="1fr 1fr 2fr"
      head={[
        "Resource",
        <span key="production" className="block text-center">
          Production p/s
        </span>,
        "Cost p/s",
      ]}
      rows={resourceTable.map((resource) => ({
        key: resource.resource_type,
        label: resource.resource?.trait ?? String(resource.resource_type),
        cells: [
          <ResourceIcon key="icon" size="xl" resource={resource.resource_type} />,
          <span key="amount" className="block text-center text-hud-display">
            {currencyFormat(resource.amount, 2)}
          </span>,
          <span key="cost" className="flex flex-col gap-3">
            {resource.cost.map((cost, index) => (
              <ResourceCost
                key={index}
                resourceId={cost.resource}
                amount={Number(currencyFormat(Number(cost.amount), 2))}
                size="lg"
              />
            ))}
          </span>,
        ],
      }))}
    />
  );
};
