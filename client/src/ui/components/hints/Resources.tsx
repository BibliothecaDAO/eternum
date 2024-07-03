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
import { tableOfContents } from "./utils";

export const Resources = () => {
  const concepts = [
    {
      name: "Resource Production",
      content: (
        <>
          <p className="my-5">
            Every resource, with the exception of Food, requires specific inputs for production. Maintaining a
            sufficient balance of these input resources is crucial; if depleted, production will cease. To ensure a
            steady supply, engage in trade with other players or utilize banking services to manage your resource
            equilibrium effectively.
          </p>
          <ResourceTable />
        </>
      ),
    },
    {
      name: "Storage",
      content: (
        <p className="my-5">
          <strong>Storehouses</strong> determine your resource storage capacity. Each storehouse adds{" "}
          <strong>10k capacity per resource type</strong>. Build more storehouses to increase storage.
        </p>
      ),
    },
  ];

  const conceptNames = concepts.map((concept) => concept.name);

  return (
    <>
      <Headline>Resources</Headline>
      {tableOfContents(conceptNames)}

      {concepts.map((concept) => (
        <div key={concept.name}>
          <h4 id={concept.name}>{concept.name}</h4>
          {concept.content}
        </div>
      ))}
    </>
  );
};

const ResourceTable = () => {
  const resourceTable = useMemo(() => {
    const resources = [];
    for (const resourceId of Object.keys(RESOURCE_INPUTS_SCALED) as unknown as ResourcesIds[]) {
      const calldata = {
        resource: findResourceById(Number(resourceId)),
        amount: RESOURCE_OUTPUTS_SCALED[resourceId],
        resource_type: resourceId,
        cost: RESOURCE_INPUTS_SCALED[resourceId].map((cost: any) => ({
          ...cost,
        })),
      };

      resources.push(calldata);
    }

    return resources;
  }, []);

  return (
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
            <td className="gap-1 flex flex-col p-2">
              {resource.cost.map((cost: any, resource_type: any) => (
                <div key={resource_type}>
                  <ResourceCost resourceId={cost.resource} amount={currencyFormat(Number(cost.amount), 0)} size="lg" />
                </div>
              ))}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
