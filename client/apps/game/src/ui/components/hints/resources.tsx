import { Headline } from "@/ui/elements/headline";
import { ResourceCost } from "@/ui/elements/resource-cost";
import { ResourceIcon } from "@/ui/elements/resource-icon";
import { currencyFormat } from "@/ui/utils/utils";
import {
  CapacityConfig,
  configManager,
  findResourceById,
  multiplyByPrecision,
  RESOURCE_PRECISION,
  ResourcesIds,
} from "@bibliothecadao/eternum";
import { useMemo } from "react";
import { tableOfContents } from "./utils";

export const Resources = () => {
  const chapters = [
    {
      title: "Resource Production",
      content: (
        <>
          <p className="my-5">
            Every resource, with the exception of Food, requires specific inputs for production. Maintaining a
            sufficient balance of these input resources is crucial; if depleted, production will cease. To ensure a
            steady supply, engage in trade with other players or utilize banking services to manage your resource
            equilibrium effectively.
            <br />
            <br />
            Be careful though, if only one of the input resources is depleted, the consumption of the other resources
            will continue.
          </p>
          <ResourceTable />
        </>
      ),
    },
    {
      title: "Storage",
      content: (
        <p className="my-5">
          <span className="font-bold">Storehouses</span> determine your resource storage capacity. Each storehouse adds
          <span className="font-bold">
            {` ${configManager.getCapacityConfigKg(CapacityConfig.Storehouse)}Kg capacity`}
          </span>
          . Build more of them to increase storage.
        </p>
      ),
    },
  ];

  const chapterTitles = chapters.map((chapter) => chapter.title);

  return (
    <>
      <Headline>Resources</Headline>
      {tableOfContents(chapterTitles)}

      {chapters.map((chapter) => (
        <div key={chapter.title}>
          <h2 id={chapter.title}>{chapter.title}</h2>
          {chapter.content}
        </div>
      ))}
    </>
  );
};

const ResourceTable = () => {
  const resourceTable = useMemo(() => {
    const resources = [];
    for (const resourceId of Object.keys(configManager.resourceInputs) as unknown as ResourcesIds[]) {
      if (resourceId == ResourcesIds.Lords) continue;
      const calldata = {
        resource: findResourceById(Number(resourceId)),
        amount: configManager.getResourceOutputs(resourceId),
        resource_type: resourceId,
        cost: configManager.resourceInputs[resourceId].map((cost: any) => ({
          ...cost,
          amount: multiplyByPrecision(cost.amount),
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
        {resourceTable.map((resource) => {
          const decimals = resource.amount > RESOURCE_PRECISION ? 0 : 2;
          return (
            <tr className="border border-gold/10" key={resource.resource_type}>
              <td>
                <ResourceIcon size="xl" resource={resource.resource?.trait || ""} />
              </td>
              <td className="text-xl text-center">{currencyFormat(resource.amount, decimals)}</td>
              <td className="gap-1 flex flex-col p-2">
                {resource.cost.map((cost, index) => {
                  return (
                    <div key={index}>
                      <ResourceCost
                        resourceId={cost.resource}
                        amount={Number(currencyFormat(Number(cost.amount), 1))}
                        size="lg"
                      />
                    </div>
                  );
                })}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};
