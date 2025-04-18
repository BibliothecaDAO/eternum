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

// Get resource category label
const getResourceCategory = (resourceId: number): { label: string; color: string } => {
  // Military resources
  if ([26, 27, 28, 29, 30, 31, 32, 33, 34].includes(resourceId)) {
    return { label: "Military", color: "#ef4444" }; // Red
  }
  // Food resources
  else if ([35, 36].includes(resourceId)) {
    return { label: "Food", color: "#f59e0b" }; // Amber
  }
  // Labor
  else if (resourceId === 23) {
    return { label: "Labor", color: "#3b82f6" }; // Blue
  }
  // Transport (Donkey)
  else if (resourceId === 25) {
    return { label: "Transport", color: "#10b981" }; // Green
  }
  // Default
  return { label: "Resource", color: "#8b5cf6" }; // Purple
};

// ResourceItem component to handle individual resource items with hover state
const ResourceItem = ({ resourceId, amount }: { resourceId: number; amount: number }) => {
  const [isHovered, setIsHovered] = useState(false);
  const resourceName = resourceIdToName[resourceId] || `Resource ${resourceId}`;
  const category = getResourceCategory(resourceId);

  const baseStyle = {
    display: "flex",
    alignItems: "center",
    padding: "0.75rem",
    backgroundColor: "rgba(31, 41, 55, 0.6)",
    borderRadius: "0.5rem",
    transition: "all 0.2s",
    position: "relative" as "relative",
    overflow: "hidden",
  };

  const hoverStyle = {
    ...baseStyle,
    backgroundColor: "rgba(55, 65, 81, 0.6)",
    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
  };

  const categoryIndicatorStyle = {
    position: "absolute" as "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "4px",
    backgroundColor: category.color,
    opacity: isHovered ? 1 : 0.7,
  };

  const categoryLabelStyle = {
    position: "absolute" as "absolute",
    top: "0.25rem",
    right: "0.5rem",
    fontSize: "0.65rem",
    fontWeight: 600,
    color: category.color,
    textTransform: "uppercase" as "uppercase",
    letterSpacing: "0.05em",
    opacity: isHovered ? 1 : 0.8,
  };

  const iconStyle = {
    marginRight: "0.75rem",
    flexShrink: 0,
    marginTop: "0.5rem",
  };

  const contentStyle = {
    flexGrow: 1,
    marginTop: "0.5rem",
  };

  const nameStyle = {
    fontWeight: 500,
    color: "#f9fafb",
    fontSize: "1rem",
  };

  const amountStyle = {
    fontSize: "1.125rem",
    fontWeight: "bold",
    color: category.color,
  };

  return (
    <div
      style={isHovered ? hoverStyle : baseStyle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div style={categoryIndicatorStyle}></div>
      <div style={categoryLabelStyle}>{category.label}</div>

      <div style={iconStyle}>
        <ResourceIcon name={resourceName} id={resourceId} size="lg" />
      </div>

      <div style={contentStyle}>
        <div style={nameStyle}>{resourceName}</div>
        <div style={amountStyle}>{formatNumber(amount)}</div>
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

  // Define styles
  const containerStyle = {
    margin: "2rem 0",
    padding: "1.5rem",
    backgroundColor: "rgba(17, 24, 39, 0.5)",
    borderRadius: "0.75rem",
    border: "1px solid rgb(31, 41, 55)",
  };

  const titleStyle = {
    fontSize: "1.5rem",
    fontWeight: "bold",
    marginBottom: "1.5rem",
    color: "#f9fafb",
    borderBottom: "1px solid rgb(75, 85, 99)",
    paddingBottom: "0.75rem",
  };

  const responsiveGridWrapperStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
    gap: "1rem",
  };

  const summaryContainerStyle = {
    marginTop: "2rem",
    borderTop: "1px solid rgb(75, 85, 99)",
    paddingTop: "1.5rem",
  };

  const summaryTitleStyle = {
    fontSize: "1.25rem",
    fontWeight: 600,
    marginBottom: "1rem",
    color: "#f9fafb",
  };

  const summaryGridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: "1rem",
  };

  const summaryCategoryStyle = {
    padding: "0.75rem",
    backgroundColor: "rgba(31, 41, 55, 0.4)",
    borderRadius: "0.5rem",
  };

  const categoryTitleStyle = (color: string) => ({
    fontSize: "1rem",
    fontWeight: 600,
    marginBottom: "0.5rem",
    color: color,
    display: "flex",
    alignItems: "center",
  });

  const dotStyle = (color: string) => ({
    width: "0.5rem",
    height: "0.5rem",
    backgroundColor: color,
    borderRadius: "9999px",
    marginRight: "0.5rem",
  });

  const totalStyle = {
    fontSize: "1.25rem",
    fontWeight: 700,
    color: "#f9fafb",
  };

  return (
    <div style={containerStyle}>
      <div style={titleStyle}>Starting Resources for {structureType}</div>

      <div style={responsiveGridWrapperStyle}>
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
        <div style={summaryContainerStyle}>
          <div style={summaryTitleStyle}>Resource Summary</div>
          <div style={summaryGridStyle}>
            {Object.entries(resourceTotals).map(([category, data], index) => {
              // Get the color for this category
              let categoryColor = "#8b5cf6"; // Default purple

              // Check if we can find the category color from the first item
              if (data.items.length > 0) {
                const firstItem = data.items[0];
                const itemCategory = getResourceCategory(firstItem.resource);
                if (itemCategory.label === category) {
                  categoryColor = itemCategory.color;
                }
              }

              return (
                <div key={index} style={summaryCategoryStyle}>
                  <div style={categoryTitleStyle(categoryColor)}>
                    <div style={dotStyle(categoryColor)}></div>
                    {category}
                  </div>
                  <div style={totalStyle}>{formatNumber(data.total)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
