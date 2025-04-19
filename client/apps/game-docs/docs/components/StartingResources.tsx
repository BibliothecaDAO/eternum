import { ETERNUM_CONFIG } from "@/utils/config";
import { useState } from "react";
import ResourceIcon from "./ResourceIcon";

export enum StructureType {
  Village = "Village",
  Realm = "Realm",
}

type Props = {
  structureType: StructureType;
};

// Helper function to format numbers with commas
const formatNumber = (num: number) => {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

// Map resource IDs to names
const resourceIdToName: Record<number, string> = {
  35: "Wheat",
  36: "Fish",
  23: "Labor",
  25: "Donkey",
  26: "Knight",
  29: "Crossbowman",
  32: "Paladin",
};

// Common styles shared with other components
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
  resourceCellStyle: {
    padding: "0.5rem",
    borderBottom: "1px solid #4d3923",
    backgroundColor: "rgba(30, 20, 10, 0.3)",
    verticalAlign: "middle" as const,
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  resourceGridStyle: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
    gap: "1rem",
    marginBottom: "1.5rem",
  },
  resourceItemStyle: {
    display: "flex",
    alignItems: "center",
    padding: "0.5rem",
    borderBottom: "1px solid #4d3923",
    backgroundColor: "rgba(30, 20, 10, 0.3)",
    borderRadius: "0.5rem",
    transition: "all 0.2s",
    position: "relative" as "relative",
    overflow: "hidden",
  },
  resourceNameStyle: {
    fontWeight: 500,
    color: "#f9fafb",
    fontSize: "0.85rem",
  },
  resourceAmountStyle: {
    fontSize: "1rem",
    fontWeight: "bold",
    color: "#dfc296",
  },
  summaryContainerStyle: {
    marginTop: "2rem",
    borderTop: "1px solid #6d4923",
    paddingTop: "1.5rem",
  },
  summaryTitleStyle: {
    fontWeight: "bold",
    fontSize: "0.9rem",
    color: "#f0b060",
    marginBottom: "0.75rem",
  },
  summaryGridStyle: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: "1rem",
  },
  summaryCategoryStyle: {
    padding: "0.75rem",
    backgroundColor: "rgba(30, 20, 10, 0.3)",
    borderRadius: "0.5rem",
    borderBottom: "1px solid #4d3923",
  },
  categoryTitleStyle: {
    fontSize: "0.85rem",
    fontWeight: 600,
    marginBottom: "0.5rem",
    display: "flex",
    alignItems: "center",
    color: "#f0b060",
  },
  totalStyle: {
    fontSize: "1.25rem",
    fontWeight: 700,
    color: "#dfc296",
  },
  indicatorStyle: {
    position: "absolute" as "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "3px",
    backgroundColor: "#f0b060",
    opacity: 0.7,
  },
  labelStyle: {
    position: "absolute" as "absolute",
    top: "0.25rem",
    right: "0.5rem",
    fontSize: "0.65rem",
    fontWeight: 600,
    color: "#dfc296",
    textTransform: "uppercase" as "uppercase",
    letterSpacing: "0.05em",
  },
};

// Get resource category label
const getResourceCategory = (resourceId: number): { label: string; shade: string } => {
  // Military resources
  if ([26, 27, 28, 29, 30, 31, 32, 33, 34].includes(resourceId)) {
    return { label: "Military", shade: "#d4af37" }; // Darker gold
  }
  // Food resources
  else if ([35, 36].includes(resourceId)) {
    return { label: "Food", shade: "#f0b060" }; // Amber gold
  }
  // Labor
  else if (resourceId === 23) {
    return { label: "Labor", shade: "#c0c0c0" }; // Silver gray
  }
  // Transport (Donkey)
  else if (resourceId === 25) {
    return { label: "Transport", shade: "#a67c00" }; // Bronze gold
  }
  // Default
  return { label: "Resource", shade: "#dfc296" }; // Light gold
};

// ResourceItem component to handle individual resource items with hover state
const ResourceItem = ({ resourceId, amount }: { resourceId: number; amount: number }) => {
  const [isHovered, setIsHovered] = useState(false);
  const resourceName = resourceIdToName[resourceId] || `Resource ${resourceId}`;
  const category = getResourceCategory(resourceId);

  return (
    <div
      style={{
        ...styles.resourceItemStyle,
        backgroundColor: isHovered ? "rgba(40, 30, 20, 0.5)" : "rgba(30, 20, 10, 0.3)",
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Category indicator at top of item */}
      <div
        style={{
          ...styles.indicatorStyle,
          backgroundColor: category.shade,
          opacity: isHovered ? 1 : 0.7,
        }}
      ></div>

      {/* Category label in top right */}
      <div style={styles.labelStyle}>{category.label}</div>

      <div style={{ marginRight: "0.75rem" }}>
        <ResourceIcon name={resourceName} id={resourceId} size="md" />
      </div>

      <div style={{ flexGrow: 1, paddingTop: "0.5rem" }}>
        <div style={styles.resourceNameStyle}>{resourceName}</div>
        <div style={styles.resourceAmountStyle}>{formatNumber(amount)}</div>
      </div>
    </div>
  );
};

export const StartingResources = ({ structureType }: Props) => {
  const config = ETERNUM_CONFIG();
  const startingResources =
    structureType === StructureType.Village ? config.villageStartingResources : config.startingResources;

  // Calculate resource totals by category
  const resourceTotals = startingResources.reduce(
    (acc, { resource, amount }) => {
      const category = getResourceCategory(resource).label;

      if (!acc[category]) {
        acc[category] = {
          total: 0,
          items: [],
        };
      }

      acc[category].total += amount;
      acc[category].items.push({ resource, amount });

      return acc;
    },
    {} as Record<string, { total: number; items: { resource: number; amount: number }[] }>,
  );

  return (
    <div style={styles.sectionStyle}>
      <div style={styles.subtitleStyle}>Starting Resources for {structureType}</div>

      <div style={styles.resourceGridStyle}>
        {startingResources.map((item, index) => (
          <ResourceItem key={index} resourceId={item.resource} amount={item.amount} />
        ))}
      </div>

      {startingResources.length === 0 && (
        <div style={{ textAlign: "center", padding: "2rem", color: "#9ca3af" }}>
          No starting resources defined for {structureType}
        </div>
      )}

      {Object.keys(resourceTotals).length > 0 && (
        <div style={styles.summaryContainerStyle}>
          <div style={styles.summaryTitleStyle}>Resource Summary</div>
          <div style={styles.summaryGridStyle}>
            {Object.entries(resourceTotals).map(([category, data], index) => {
              // Get the shade for this category (always gold/amber now)
              const goldShade = "#f0b060";

              return (
                <div key={index} style={styles.summaryCategoryStyle}>
                  <div style={styles.categoryTitleStyle}>
                    <div
                      style={{
                        width: "0.5rem",
                        height: "0.5rem",
                        backgroundColor: goldShade,
                        borderRadius: "9999px",
                        marginRight: "0.5rem",
                      }}
                    ></div>
                    {category}
                  </div>
                  <div style={styles.totalStyle}>{formatNumber(data.total)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
