import { table } from "@/components/styles";
import { STEALABLE_RESOURCES, resources } from "@bibliothecadao/types";
import ResourceIcon from "./ResourceIcon";

export const RaidableResources = () => {
  return (
    <div style={table.container}>
      <div style={table.wrapper}>
        <table style={table.table}>
          <thead style={table.tableHead}>
            <tr>
              <th style={table.headerCell}>#</th>
              <th style={table.headerCell}>Resource</th>
            </tr>
          </thead>
          <tbody>
            {[...STEALABLE_RESOURCES].map((resourceId, index) => {
              const resource = resources.find((r) => r.id === resourceId);
              if (!resource) return null;

              return (
                <tr key={resourceId} style={table.tableRow}>
                  <td style={table.cell}>{index + 1}</td>
                  <td style={table.resourceCell}>
                    <ResourceIcon name={resource.trait} id={resource.id} size="md" />
                    {resource.trait}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
