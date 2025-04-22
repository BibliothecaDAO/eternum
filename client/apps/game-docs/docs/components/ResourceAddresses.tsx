import { getResourceAddresses } from "@/utils/addresses";
import { resources, ResourcesIds } from "@bibliothecadao/types";
import ResourceIcon from "./ResourceIcon";
import { colors, section, table } from "./styles";

// Additional component-specific styles
const componentStyles = {
  resourceNameWithId: {
    display: "flex",
    flexDirection: "column" as const,
  },
  resourceId: {
    fontSize: "0.7rem",
    color: "#999",
    marginTop: "0.2rem",
  },
  addressCell: {
    ...table.cell,
    color: colors.secondary,
    fontFamily: "monospace",
    fontSize: "0.8rem",
  },
};

// Helper function to get resource name
const getResourceName = (id: number): string => {
  return resources.find((r) => r.id === Number(id))?.trait || `Resource ${id}`;
};

export const ResourceAddresses = () => {
  const addresses = getResourceAddresses();

  // Transform the address data for display
  const addressesArray = Object.entries(addresses)
    .map(([resourceName, data]) => {
      // data is an array where first element is the ID and second is the address
      const id = data[0] as number;
      const address = data[1] as string;

      // remove the ancient fragment from the list because it's not bridgeable
      if (id === ResourcesIds.AncientFragment) return null;

      return {
        resourceName,
        id,
        address,
      };
    })
    .filter((item) => item !== null)
    .sort((a, b) => a.id - b.id);

  return (
    <div style={section.wrapper}>
      <div style={section.subtitle}>Resource Addresses</div>
      <table style={table.table}>
        <thead>
          <tr>
            <th style={table.headerCell}>Resource</th>
            <th style={table.headerCell}>Address</th>
          </tr>
        </thead>
        <tbody>
          {addressesArray.map((item) => (
            <tr key={`address-${item.id}`}>
              <td style={table.resourceCell}>
                <ResourceIcon id={item.id} name={item.resourceName} size="md" />
                <div style={componentStyles.resourceNameWithId}>
                  {item.resourceName.charAt(0) + item.resourceName.slice(1).toLowerCase()}
                  <span style={componentStyles.resourceId}>ID: {item.id}</span>
                </div>
              </td>
              <td style={componentStyles.addressCell}>{item.address}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
