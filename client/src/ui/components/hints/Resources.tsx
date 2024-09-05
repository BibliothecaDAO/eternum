import { Headline } from "@/ui/elements/Headline";
import { ResourceCost } from "@/ui/elements/ResourceCost";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import { currencyFormat } from "@/ui/utils/utils";
import {
  EternumGlobalConfig,
  RESOURCE_INPUTS_SCALED,
  RESOURCE_OUTPUTS_SCALED,
  ResourcesIds,
  findResourceById,
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
            {` ${
              EternumGlobalConfig.resources.storehouseCapacityKg /
              (EternumGlobalConfig.resources.resourceMultiplier * EternumGlobalConfig.resources.resourcePrecision)
            }M capacity per resource type`}
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
    for (const resourceId of Object.keys(RESOURCE_INPUTS_SCALED) as unknown as ResourcesIds[]) {
      if (resourceId == ResourcesIds.Lords) continue;
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
              <ResourceIcon size="xl" resource={resource.resource?.trait || ""} />
            </td>
            <td className="text-xl text-center">{currencyFormat(resource.amount, 0)}</td>
            <td className="gap-1 flex flex-col p-2">
              {resource.cost.map((cost: any, resource_type: any) => (
                <div key={resource_type}>
                  <ResourceCost
                    resourceId={cost.resource}
                    amount={Number(currencyFormat(Number(cost.amount), 0))}
                    size="lg"
                  />
                </div>
              ))}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
