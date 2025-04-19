import { ETERNUM_CONFIG } from "@/utils/config";
import { resources } from "@bibliothecadao/types";
import ResourceIcon from "./ResourceIcon";

// Helper function to format numbers with commas
const formatAmount = (amount: number): string => {
  return new Intl.NumberFormat().format(Math.round(amount * 100) / 100);
};

// Common styles shared between components
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
    padding: "0.8rem",
    borderBottom: "1px solid #4d3923",
    backgroundColor: "rgba(30, 20, 10, 0.3)",
    verticalAlign: "middle" as const,
  },
  resourceCellStyle: {
    padding: "0.8rem",
    borderBottom: "1px solid #4d3923",
    backgroundColor: "rgba(30, 20, 10, 0.3)",
    verticalAlign: "middle" as const,
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  productionCellStyle: {
    padding: "0.8rem",
    borderBottom: "1px solid #4d3923",
    backgroundColor: "rgba(30, 20, 10, 0.3)",
    verticalAlign: "middle" as const,
    color: "#dfc296",
  },
  resourceGroupStyle: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: "0.25rem",
    alignItems: "center",
  },
  resourceItemStyle: {
    display: "flex",
    alignItems: "center",
    gap: "0.25rem",
    padding: "0.125rem 0.25rem",
    backgroundColor: "rgba(40, 30, 25, 0.6)",
    borderRadius: "0.25rem",
    fontSize: "0.75rem",
  },
};

// Helper function to get resource name
const getResourceName = (id: number): string => {
  return resources.find((r) => r.id === id)?.trait || `Resource ${id}`;
};

// Component for Hyperstructure Construction Costs
export const HyperstructureConstructionCostTable = () => {
  const config = ETERNUM_CONFIG();
  const hyperstructureConstructionCost = config.hyperstructures.hyperstructureConstructionCost;

  // Get all hyperstructure IDs and sort them for consistent display
  const resourceIds = Object.keys(hyperstructureConstructionCost).sort((a, b) => {
    const aId = parseInt(a);
    const bId = parseInt(b);
    return aId - bId;
  });

  return (
    <div style={styles.sectionStyle}>
      <div style={styles.subtitleStyle}>Hyperstructure Construction Costs</div>
      <table style={styles.tableStyle}>
        <thead>
          <tr>
            <th style={styles.headerCellStyle}>Resource</th>
            <th style={styles.headerCellStyle}>Completion Points</th>
            <th style={styles.headerCellStyle}>Min Amount</th>
            <th style={styles.headerCellStyle}>Max Amount</th>
          </tr>
        </thead>
        <tbody>
          {resourceIds.map((hyperstructureId) => {
            const costs = hyperstructureConstructionCost[hyperstructureId];
            const { resource_type, resource_completion_points, min_amount, max_amount } = costs;
            const resourceId = parseInt(resource_type);
            const resourceName = getResourceName(resourceId);

            return (
              <tr key={`construction-${hyperstructureId}`}>
                <td style={styles.productionCellStyle}>
                  <div style={styles.resourceItemStyle}>
                    <ResourceIcon id={resourceId} name={resourceName} size="md" />
                    {resourceName}
                  </div>
                </td>
                <td style={styles.productionCellStyle}>
                  {resource_completion_points > 0 ? formatAmount(Number(resource_completion_points)) : "-"}
                </td>
                <td style={styles.productionCellStyle}>
                  {min_amount && min_amount !== max_amount
                    ? formatAmount(Number(min_amount))
                    : formatAmount(Number(max_amount))}
                </td>
                <td style={styles.productionCellStyle}>{formatAmount(Number(max_amount))}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// Component for Hyperstructure Initialization Shards Cost
export const HyperstructureInitializationShardsTable = () => {
  const config = ETERNUM_CONFIG();
  const hyperstructureInitializationShardsCost = config.hyperstructures.hyperstructureInitializationShardsCost;
  const resourceId = hyperstructureInitializationShardsCost.resource;
  const resourceName = getResourceName(resourceId);
  const amount = hyperstructureInitializationShardsCost.amount;

  return (
    <div style={styles.sectionStyle}>
      <div style={styles.subtitleStyle}>Hyperstructure Initialization Shards Cost</div>
      <table style={styles.tableStyle}>
        <thead>
          <tr>
            <th style={styles.headerCellStyle}>Resource</th>
            <th style={styles.headerCellStyle}>Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr key={`shards-${resourceId}`}>
            <td style={styles.productionCellStyle}>
              <div style={styles.resourceItemStyle}>
                <ResourceIcon id={resourceId} name={resourceName} size="md" />
                {resourceName}
              </div>
            </td>
            <td style={styles.productionCellStyle}>{formatAmount(Number(amount))}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

// Component for Hyperstructure Points Information
export const HyperstructurePointsTable = () => {
  const config = ETERNUM_CONFIG();
  const hyperstructurePointsPerCycle = config.hyperstructures.hyperstructurePointsPerCycle;
  const hyperstructurePointsForWin = config.hyperstructures.hyperstructurePointsForWin;

  return (
    <div style={styles.sectionStyle}>
      <div style={styles.subtitleStyle}>Hyperstructure Points Information</div>
      <table style={styles.tableStyle}>
        <thead>
          <tr>
            <th style={styles.headerCellStyle}>Metric</th>
            <th style={styles.headerCellStyle}>Value</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={styles.productionCellStyle}>Points Per Cycle</td>
            <td style={styles.productionCellStyle}>
              <div style={styles.resourceItemStyle}>{formatAmount(Number(hyperstructurePointsPerCycle))} points</div>
            </td>
          </tr>
          <tr>
            <td style={styles.productionCellStyle}>Points Required For Win</td>
            <td style={styles.productionCellStyle}>
              <div style={styles.resourceItemStyle}>{formatAmount(Number(hyperstructurePointsForWin))} points</div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export const HyperstructureTable = () => {
  return (
    <div>
      <HyperstructurePointsTable />
      <HyperstructureInitializationShardsTable />
      <HyperstructureConstructionCostTable />
    </div>
  );
};
