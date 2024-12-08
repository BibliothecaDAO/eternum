import {
  EternumGlobalConfig,
  findResourceById,
  RESOURCE_INPUTS,
  RESOURCE_OUTPUTS,
  ResourcesIds,
} from "@bibliothecadao/eternum";
import { useMemo } from "react";
import ResourceIcon from "./ResourceIcon";

export default function ResourceTable() {
  const resourceTable = useMemo(() => {
    const resources = [];
    for (const resourceId of Object.keys(RESOURCE_INPUTS) as unknown as ResourcesIds[]) {
      if (resourceId == ResourcesIds.Lords) continue;
      const calldata = {
        resource: findResourceById(Number(resourceId)),
        amount: RESOURCE_OUTPUTS[resourceId],
        resource_type: resourceId,
        cost: RESOURCE_INPUTS[resourceId].map((cost: any) => ({
          ...cost,
          amount: cost.amount * EternumGlobalConfig.resources.resourcePrecision,
          name: findResourceById(cost.resource)?.trait || "",
        })),
      };

      resources.push(calldata);
    }

    return resources;
  }, []);

  return (
    <div>
      <table className="w-full border border-separate border-spacing-y-5">
        <thead>
          <tr>
            <th className="border-b">Resource</th>
            <th className="border-b">Production p/s</th>
            <th className="border-b">Cost p/s</th>
          </tr>
        </thead>
        <tbody>
          {resourceTable.map((resource) => {
            return (
              <tr key={resource.resource_type}>
                <td className="border-b">
                  <ResourceIcon size={80} id={resource.resource?.id || 0} name={resource.resource?.trait || ""} />
                </td>
                <td className="text-center border-b">{resource.amount}</td>
                <td className="py-2 border-b">
                  <div className="flex flex-col gap-4 justify-between">
                    {resource.cost.map((cost) => (
                      <div key={cost.resource} className="grid grid-cols-2">
                        <ResourceIcon size={30} id={cost.resource} name={cost.name || ""} />
                        <div className="flex flex-col">
                          <span>{cost.amount}</span>
                          <span className="font-bold">{cost.name}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
