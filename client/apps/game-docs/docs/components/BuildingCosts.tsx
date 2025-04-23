import { ETERNUM_CONFIG } from "@/utils/config";
import { BuildingType, resources } from "@bibliothecadao/types";
import ResourceIcon from "./ResourceIcon";
import { colors, formatAmount } from "./styles";

type Props = {
  buildingType: BuildingType;
};

export default function BuildingCosts({ buildingType }: Props) {
  const config = ETERNUM_CONFIG();

  // Get costs directly from the config files
  const complexCosts = config.buildings.complexBuildingCosts[buildingType] || [];
  const simpleCosts = config.buildings.simpleBuildingCost[buildingType] || [];

  // Check if this is a resource building (Wood, Stone, etc)
  const isResourceBuilding =
    (buildingType >= BuildingType.ResourceStone && buildingType <= BuildingType.ResourceDragonhide) ||
    buildingType === BuildingType.ResourceWheat ||
    buildingType === BuildingType.ResourceFish;

  // For T2 and T3 military buildings (complex mode only)
  const isComplexOnly =
    buildingType === BuildingType.ResourceKnightT2 ||
    buildingType === BuildingType.ResourceCrossbowmanT2 ||
    buildingType === BuildingType.ResourcePaladinT2 ||
    buildingType === BuildingType.ResourceKnightT3 ||
    buildingType === BuildingType.ResourceCrossbowmanT3 ||
    buildingType === BuildingType.ResourcePaladinT3;

  // Compact styles
  const styles = {
    container: {
      marginTop: "0.5rem",
      borderTop: `1px solid ${colors.borderDark}`,
      paddingTop: "0.5rem",
    },
    title: {
      fontWeight: "bold",
      fontSize: "0.875rem",
      color: "#f6c297",
      marginBottom: "0.375rem",
    },
    modeHeader: {
      fontSize: "0.75rem",
      color: colors.primary,
      backgroundColor: "rgba(60, 40, 20, 0.3)",
      padding: "0.125rem 0.375rem",
      borderRadius: "0.25rem",
      marginBottom: "0.25rem",
      display: "inline-block",
    },
    costsContainer: {
      display: "flex",
      flexWrap: "wrap" as const,
      gap: "0.25rem",
      marginBottom: "0.5rem",
    },
    costItem: {
      display: "flex",
      alignItems: "center",
      gap: "0.25rem",
      padding: "0.25rem 0.375rem",
      backgroundColor: "rgba(40, 30, 25, 0.6)",
      borderRadius: "0.25rem",
      fontSize: "0.75rem",
    },
  };

  if (simpleCosts.length === 0 && complexCosts.length === 0) return null;

  // Resource buildings have the same cost in both modes
  if (isResourceBuilding) {
    const costs = complexCosts;
    return (
      <div style={styles.container}>
        <div style={styles.title}>Building Costs</div>
        <div style={styles.costsContainer}>
          {costs.map((cost) => (
            <div key={cost.resource} style={styles.costItem}>
              <ResourceIcon
                id={cost.resource}
                name={resources.find((r) => r.id === cost.resource)?.trait || ""}
                size="md"
              />
              {formatAmount(cost.amount)}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Military T2/T3 buildings are complex mode only
  if (isComplexOnly) {
    return (
      <div style={styles.container}>
        <div style={styles.title}>Building Costs</div>
        <div style={styles.modeHeader}>Standard Only</div>
        <div style={styles.costsContainer}>
          {complexCosts.map((cost) => (
            <div key={cost.resource} style={styles.costItem}>
              <ResourceIcon
                id={cost.resource}
                name={resources.find((r) => r.id === cost.resource)?.trait || ""}
                size="md"
              />
              {formatAmount(cost.amount)}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // For regular buildings that have both simple and complex modes
  return (
    <div style={styles.container}>
      <div style={styles.title}>Building Costs</div>

      <div>
        <div style={styles.modeHeader}>Simple</div>
        <div style={styles.costsContainer}>
          {simpleCosts.map((cost) => (
            <div key={cost.resource} style={styles.costItem}>
              <ResourceIcon
                id={cost.resource}
                name={resources.find((r) => r.id === cost.resource)?.trait || ""}
                size="md"
              />
              {formatAmount(cost.amount)}
            </div>
          ))}
        </div>
      </div>

      <div>
        <div style={styles.modeHeader}>Standard</div>
        <div style={styles.costsContainer}>
          {complexCosts.map((cost) => (
            <div key={cost.resource} style={styles.costItem}>
              <ResourceIcon
                id={cost.resource}
                name={resources.find((r) => r.id === cost.resource)?.trait || ""}
                size="md"
              />
              {formatAmount(cost.amount)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
