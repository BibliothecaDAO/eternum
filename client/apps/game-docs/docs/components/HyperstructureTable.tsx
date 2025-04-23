import { ETERNUM_CONFIG } from "@/utils/config";
import { resources } from "@bibliothecadao/types";
import ResourceIcon from "./ResourceIcon";
import { formatAmount, section, table } from "./styles";

export const HYPERSTRUCTURE_POINT_MULTIPLIER = 1_000_000;

// Helper function to get resource name
const getResourceName = (id: number): string => {
  return resources.find((r) => r.id === id)?.trait || `Resource ${id}`;
};

// Helper function to get total hyperstructure completion points
export const getTotalHyperstructureCompletionPoints = (): number => {
  const config = ETERNUM_CONFIG();
  const hyperstructureConstructionCost = config.hyperstructures.hyperstructureConstructionCost;

  // Get all hyperstructure IDs
  const resourceIds = Object.keys(hyperstructureConstructionCost);

  // Calculate total completion points by summing all resource_completion_points
  const totalPoints = resourceIds.reduce((total, hyperstructureId) => {
    const costs = hyperstructureConstructionCost[hyperstructureId];
    const completionPoints = Number(costs.resource_completion_points) || 0;
    return total + completionPoints;
  }, 0);

  return totalPoints / HYPERSTRUCTURE_POINT_MULTIPLIER;
};

// Additional component-specific styles
const componentStyles = {
  resourceItemStyle: {
    display: "flex",
    alignItems: "center",
    gap: "0.25rem",
    padding: "0.125rem 0.25rem",
    backgroundColor: "rgba(40, 30, 25, 0.6)",
    borderRadius: "0.25rem",
    fontSize: "0.75rem",
  },
  resourceGroupStyle: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: "0.25rem",
    alignItems: "center",
  },
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
    <div style={section.wrapper}>
      <div style={section.subtitle}>Hyperstructure Construction Costs</div>
      <table style={table.table}>
        <thead>
          <tr>
            <th style={table.headerCell}>Resource</th>
            <th style={table.headerCell}>Completion Points</th>
            <th style={table.headerCell}>Min Amount</th>
            <th style={table.headerCell}>Max Amount</th>
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
                <td style={table.weightCell}>
                  <div style={componentStyles.resourceItemStyle}>
                    <ResourceIcon id={resourceId} name={resourceName} size="md" />
                    {resourceName}
                  </div>
                </td>
                <td style={table.weightCell}>
                  {resource_completion_points > 0
                    ? formatAmount(Number(resource_completion_points / HYPERSTRUCTURE_POINT_MULTIPLIER))
                    : "-"}
                </td>
                <td style={table.weightCell}>
                  {min_amount && min_amount !== max_amount
                    ? formatAmount(Number(min_amount))
                    : formatAmount(Number(max_amount))}
                </td>
                <td style={table.weightCell}>{formatAmount(Number(max_amount))}</td>
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
    <div style={section.wrapper}>
      <div style={section.subtitle}>Hyperstructure Initialization Shards Cost</div>
      <table style={table.table}>
        <thead>
          <tr>
            <th style={table.headerCell}>Resource</th>
            <th style={table.headerCell}>Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr key={`shards-${resourceId}`}>
            <td style={table.weightCell}>
              <div style={componentStyles.resourceItemStyle}>
                <ResourceIcon id={resourceId} name={resourceName} size="md" />
                {resourceName}
              </div>
            </td>
            <td style={table.weightCell}>{formatAmount(Number(amount))}</td>
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
    <div style={section.wrapper}>
      <div style={section.subtitle}>Hyperstructure Points Information</div>
      <table style={table.table}>
        <thead>
          <tr>
            <th style={table.headerCell}>Metric</th>
            <th style={table.headerCell}>Value</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={table.weightCell}>Points Per Cycle</td>
            <td style={table.weightCell}>
              <div style={componentStyles.resourceItemStyle}>
                {formatAmount(Number(hyperstructurePointsPerCycle / HYPERSTRUCTURE_POINT_MULTIPLIER))} points
              </div>
            </td>
          </tr>
          <tr>
            <td style={table.weightCell}>Points Required For Win</td>
            <td style={table.weightCell}>
              <div style={componentStyles.resourceItemStyle}>
                {formatAmount(Number(hyperstructurePointsForWin) / HYPERSTRUCTURE_POINT_MULTIPLIER)} points
              </div>
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
