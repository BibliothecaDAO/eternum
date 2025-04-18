import { ETERNUM_CONFIG } from "@/utils/config";
import { ResourcesIds, resources } from "@bibliothecadao/types";
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
  productionCellStyle: {
    padding: "0.5rem",
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

// Component for Simple Mode Resource Production
export const SimpleResourceProduction = () => {
  const config = ETERNUM_CONFIG();
  const resourceInputSimpleMode = config.resources.productionBySimpleRecipe;
  const resourceOutputSimpleMode = config.resources.productionBySimpleRecipeOutputs;

  // Get all resource IDs with production data for simple mode
  const simpleResourceIds = Object.keys(resourceInputSimpleMode)
    .map(Number)
    .filter((id) => id !== ResourcesIds.Labor && resourceInputSimpleMode[id]?.length > 0)
    .sort((a, b) => a - b);

  return (
    <div style={styles.sectionStyle}>
      <div style={styles.subtitleStyle}>Simple Mode Production</div>
      <table style={styles.tableStyle}>
        <thead>
          <tr>
            <th style={styles.headerCellStyle}>Resource</th>
            <th style={styles.headerCellStyle}>Input Resources</th>
            <th style={styles.headerCellStyle}>Output</th>
          </tr>
        </thead>
        <tbody>
          {simpleResourceIds.map((resourceId) => {
            const resourceName = getResourceName(resourceId);
            const outputAmount = resourceOutputSimpleMode[resourceId] || 0;

            return (
              <tr key={`simple-${resourceId}`}>
                <td style={styles.resourceCellStyle}>
                  <ResourceIcon id={resourceId} name={resourceName} size="md" />
                  {resourceName}
                </td>
                <td style={styles.productionCellStyle}>
                  <div style={styles.resourceGroupStyle}>
                    {resourceInputSimpleMode[resourceId].map((input, idx) => (
                      <div key={`${input.resource}-${idx}`} style={styles.resourceItemStyle}>
                        <ResourceIcon id={input.resource} name={getResourceName(input.resource)} size="xs" />
                        {formatAmount(input.amount)}/s
                      </div>
                    ))}
                  </div>
                </td>
                <td style={styles.productionCellStyle}>
                  <div style={styles.resourceItemStyle}>
                    <ResourceIcon id={resourceId} name={resourceName} size="xs" />
                    {formatAmount(outputAmount)}/s
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// Component for Complex Mode Resource Production
export const StandardResourceProduction = () => {
  const config = ETERNUM_CONFIG();
  const resourceInputComplexMode = config.resources.productionByComplexRecipe;
  const resourceOutputComplexMode = config.resources.productionByComplexRecipeOutputs;

  // Get all resource IDs with production data for complex mode
  const complexResourceIds = Object.keys(resourceInputComplexMode)
    .map(Number)
    .filter((id) => id !== ResourcesIds.Labor && resourceInputComplexMode[id]?.length > 0)
    .sort((a, b) => a - b);

  return (
    <div style={styles.sectionStyle}>
      <div style={styles.subtitleStyle}>Standard Mode Production</div>
      <table style={styles.tableStyle}>
        <thead>
          <tr>
            <th style={styles.headerCellStyle}>Resource</th>
            <th style={styles.headerCellStyle}>Input Resources</th>
            <th style={styles.headerCellStyle}>Output</th>
          </tr>
        </thead>
        <tbody>
          {complexResourceIds.map((resourceId) => {
            const resourceName = getResourceName(resourceId);
            const outputAmount = resourceOutputComplexMode[resourceId] || 0;

            return (
              <tr key={`complex-${resourceId}`}>
                <td style={styles.resourceCellStyle}>
                  <ResourceIcon id={resourceId} name={resourceName} size="md" />
                  {resourceName}
                </td>
                <td style={styles.productionCellStyle}>
                  <div style={styles.resourceGroupStyle}>
                    {resourceInputComplexMode[resourceId].map((input, idx) => (
                      <div key={`${input.resource}-${idx}`} style={styles.resourceItemStyle}>
                        <ResourceIcon id={input.resource} name={getResourceName(input.resource)} size="xs" />
                        {formatAmount(input.amount)}/s
                      </div>
                    ))}
                  </div>
                </td>
                <td style={styles.productionCellStyle}>
                  <div style={styles.resourceItemStyle}>
                    <ResourceIcon id={resourceId} name={resourceName} size="xs" />
                    {formatAmount(outputAmount)}/s
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// Component for Labor Production
export const LaborProduction = () => {
  const config = ETERNUM_CONFIG();
  const laborOutputPerResource = config.resources.laborOutputPerResource;

  // Get resources that produce labor
  const laborProducingResources = Object.keys(laborOutputPerResource)
    .map(Number)
    .filter((id) => laborOutputPerResource[id] > 0)
    .sort((a, b) => a - b);

  return (
    <div style={styles.sectionStyle}>
      <div style={styles.subtitleStyle}>Labor Production</div>
      <table style={styles.tableStyle}>
        <thead>
          <tr>
            <th style={styles.headerCellStyle}>Resource</th>
            <th style={styles.headerCellStyle}>Input</th>
            <th style={styles.headerCellStyle}>Labor Output</th>
          </tr>
        </thead>
        <tbody>
          {laborProducingResources.map((resourceId) => {
            const resourceName = getResourceName(resourceId);
            const laborOutput = laborOutputPerResource[resourceId] || 0;

            return (
              <tr key={`labor-${resourceId}`}>
                <td style={styles.resourceCellStyle}>
                  <ResourceIcon id={resourceId} name={resourceName} size="md" />
                  {resourceName}
                </td>
                <td style={styles.productionCellStyle}>
                  <div style={styles.resourceItemStyle}>
                    <ResourceIcon id={resourceId} name={resourceName} size="xs" />
                    1/s
                  </div>
                </td>
                <td style={styles.productionCellStyle}>
                  <div style={styles.resourceItemStyle}>
                    <ResourceIcon id={ResourcesIds.Labor} name="Labor" size="xs" />
                    {formatAmount(laborOutput)}/s
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
