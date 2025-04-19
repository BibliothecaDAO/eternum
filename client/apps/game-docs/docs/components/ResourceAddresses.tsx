import { getResourceAddresses } from "@/utils/addresses";
import { resources, ResourcesIds } from "@bibliothecadao/types";
import ResourceIcon from "./ResourceIcon";

// Helper function to format numbers with commas
const formatAmount = (amount: number): string => {
  return new Intl.NumberFormat().format(Math.round(amount * 100) / 100);
};

// Common styles shared with WeightTable component
const styles = {
  sectionStyle: {
    marginBottom: "2rem",
  },
  subtitleStyle: {
    fontWeight: "bold",
    fontSize: "0.9rem",
    color: "#f0b060",
    marginBottom: "0.75rem",
    marginTop: "1.5rem",
  },
  tableStyle: {
    width: "100%",
    borderCollapse: "collapse" as const,
    fontSize: "0.85rem",
  },
  headerCellStyle: {
    padding: "0.5rem",
    backgroundColor: "rgba(60, 40, 20, 0.5)",
    color: "#f0b060",
    fontWeight: "bold",
    textAlign: "left" as const,
    borderBottom: "1px solid #6d4923",
  },
  cellStyle: {
    padding: "0.5rem",
    borderBottom: "1px solid #4d3923",
    backgroundColor: "rgba(30, 20, 10, 0.3)",
    verticalAlign: "middle" as const,
  },
  resourceCellStyle: {
    padding: "0.5rem",
    borderBottom: "1px solid #4d3923",
    backgroundColor: "rgba(30, 20, 10, 0.3)",
    verticalAlign: "middle" as const,
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  addressCellStyle: {
    padding: "0.5rem",
    borderBottom: "1px solid #4d3923",
    backgroundColor: "rgba(30, 20, 10, 0.3)",
    verticalAlign: "middle" as const,
    color: "#dfc296",
    fontFamily: "monospace",
    fontSize: "0.8rem",
  },
  resourceNameWithId: {
    display: "flex",
    flexDirection: "column" as const,
  },
  resourceId: {
    fontSize: "0.7rem",
    color: "#999",
    marginTop: "0.2rem",
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
    <div style={styles.sectionStyle}>
      <div style={styles.subtitleStyle}>Resource Addresses</div>
      <table style={styles.tableStyle}>
        <thead>
          <tr>
            <th style={styles.headerCellStyle}>Resource</th>
            <th style={styles.headerCellStyle}>Address</th>
          </tr>
        </thead>
        <tbody>
          {addressesArray.map((item) => (
            <tr key={`address-${item.id}`}>
              <td style={styles.resourceCellStyle}>
                <ResourceIcon id={item.id} name={item.resourceName} size="md" />
                <div style={styles.resourceNameWithId}>
                  {item.resourceName.charAt(0) + item.resourceName.slice(1).toLowerCase()}
                  <span style={styles.resourceId}>ID: {item.id}</span>
                </div>
              </td>
              <td style={styles.addressCellStyle}>{item.address}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
