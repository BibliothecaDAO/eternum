import { ETERNUM_CONFIG } from "@/utils/config";
import { resources } from "@bibliothecadao/types";
import ResourceIcon from "./ResourceIcon";

// Helper function to format numbers with commas
const formatAmount = (amount: number): string => {
  return new Intl.NumberFormat().format(Math.round(amount * 100) / 100);
};

// Common styles shared with ResourceProduction component
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
  weightCellStyle: {
    padding: "0.5rem",
    borderBottom: "1px solid #4d3923",
    backgroundColor: "rgba(30, 20, 10, 0.3)",
    verticalAlign: "middle" as const,
    color: "#dfc296",
  },
};

// Helper function to get resource name
const getResourceName = (id: number): string => {
  return resources.find((r) => r.id === Number(id))?.trait || `Resource ${id}`;
};

export const WeightTable = () => {
  const config = ETERNUM_CONFIG();
  const weights = config.resources.resourceWeightsGrams;

  const weightsArray = Object.entries(weights)
    .map(([resource, weight]) => ({
      resource: Number(resource),
      weight: weight,
    }))
    .sort((a, b) => a.resource - b.resource);

  return (
    <div style={styles.sectionStyle}>
      <div style={styles.subtitleStyle}>Resource Weights (grams)</div>
      <table style={styles.tableStyle}>
        <thead>
          <tr>
            <th style={styles.headerCellStyle}>Resource</th>
            <th style={styles.headerCellStyle}>Weight (kg)</th>
          </tr>
        </thead>
        <tbody>
          {weightsArray.map((item) => (
            <tr key={`weight-${item.resource}`}>
              <td style={styles.resourceCellStyle}>
                <ResourceIcon id={item.resource} name={getResourceName(item.resource)} size="md" />
                {getResourceName(item.resource)}
              </td>
              <td style={styles.weightCellStyle}>{formatAmount(item.weight / 1000)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
