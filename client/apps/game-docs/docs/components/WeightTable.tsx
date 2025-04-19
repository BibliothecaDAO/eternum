import { ETERNUM_CONFIG } from "@/utils/config";
import { resources } from "@bibliothecadao/types";
import ResourceIcon from "./ResourceIcon";
import { formatAmount, section, table } from "./styles";

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
    <div style={section.wrapper}>
      <div style={section.subtitle}>Resource Weights (grams)</div>
      <table style={table.table}>
        <thead>
          <tr>
            <th style={table.headerCell}>Resource</th>
            <th style={table.headerCell}>Weight (kg)</th>
          </tr>
        </thead>
        <tbody>
          {weightsArray.map((item) => (
            <tr key={`weight-${item.resource}`}>
              <td style={table.resourceCell}>
                <ResourceIcon id={item.resource} name={getResourceName(item.resource)} size="md" />
                {getResourceName(item.resource)}
              </td>
              <td style={table.weightCell}>{formatAmount(item.weight / 1000)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
