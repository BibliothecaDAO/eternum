import { table } from "@/components/styles";
import { ResourcesIds, STEALABLE_RESOURCES, resources } from "@bibliothecadao/types";
import ResourceIcon from "./ResourceIcon";

export const RaidableResources = () => {
  if (!STEALABLE_RESOURCES) {
    console.error("STEALABLE_RESOURCES is undefined");
    return <div>Error: STEALABLE_RESOURCES not found</div>;
  }

  if (!resources) {
    console.error("resources is undefined");
    return <div>Error: resources not found</div>;
  }

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
                    {resourceId === ResourcesIds.Lords && (
                      <span style={{ marginLeft: "8px", color: "#ff9800" }}>
                        ⚠️{" "}
                        <span style={{ fontSize: "0.85em" }}>No materials are safe, even $LORDS can be pillaged</span>
                      </span>
                    )}
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
