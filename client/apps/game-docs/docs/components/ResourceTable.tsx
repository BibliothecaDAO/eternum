import { ETERNUM_CONFIG } from "@/utils/config";
import { RESOURCE_PRECISION } from "@/utils/constants";
import { findResourceById } from "@/utils/resources";
import { ResourcesIds } from "@/utils/types";
import { useMemo } from "react";
import ResourceIcon from "./ResourceIcon";

const eternumConfig = ETERNUM_CONFIG();

export default function ResourceTable() {
  const resourceTable = useMemo(() => {
    const resources = [];
    for (const resourceId of Object.keys(
      eternumConfig.resources.productionByComplexRecipe,
    ) as unknown as ResourcesIds[]) {
      if (resourceId === ResourcesIds.Lords) continue;
      const calldata = {
        resource: findResourceById(Number(resourceId)),
        amount: eternumConfig.resources.productionByComplexRecipe[resourceId],
        resource_type: resourceId,
        cost: eternumConfig.resources.productionByComplexRecipe[resourceId].map((cost: any) => ({
          ...cost,
          amount: cost.amount * RESOURCE_PRECISION,
          name: findResourceById(cost.resource)?.trait || "",
        })),
      };

      resources.push(calldata);
    }

    return resources;
  }, []);

  return (
    <div className="px-6 pt-6 mb-6 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/5">
      <table className="w-full border-separate border-gray-700 border-spacing-y-5">
        <thead>
          <tr>
            <th className="border-b border-gray-500 text-left">Resource</th>
            <th className="border-b border-gray-500 pb-2 text-center">Production p/s</th>
            <th className="border-b border-gray-500 pb-2 text-left">Cost p/s</th>
          </tr>
        </thead>
        <tbody>
          {resourceTable.map((resource) => (
            <tr key={resource.resource_type}>
              <td className="border-b border-gray-500 py-4">
                <div className="flex items-center gap-4">
                  <ResourceIcon size="xl" id={resource.resource?.id || 0} name={resource.resource?.trait || ""} />
                  <div className="text-lg text-gray-400 dark:text-gray-300 font-medium">
                    {resource.resource?.trait || "Unknown Resource"}
                  </div>
                </div>
              </td>

              <td className="text-center border-b border-gray-500">{resource.amount.toString()}</td>

              <td className="py-2 border-b border-gray-500">
                <div className="flex flex-col gap-4">
                  {resource.cost.map((cost) => (
                    <div key={cost.resource} className="p-3 rounded-lg border border-gray-500 bg-gray-800">
                      <div className="flex items-center gap-2">
                        <ResourceIcon size="lg" id={cost.resource} name={cost.name || ""} />
                        <div>
                          <span className="text-md">{cost.amount.toString()}</span>
                          <div className="font-bold">{cost.name}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
