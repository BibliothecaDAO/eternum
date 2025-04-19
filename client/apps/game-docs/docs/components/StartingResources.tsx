import { ETERNUM_CONFIG } from "@/utils/config";
import { useState } from "react";
import ResourceIcon from "./ResourceIcon";
import { colors, formatNumber, resource, section } from "./styles";

export enum StructureType {
  Village = "Village",
  Realm = "Realm",
}

type Props = {
  structureType: StructureType;
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
const getResourceCategory = (resourceId: number): { label: string; shade: string } => {
  // Military resources
  if ([26, 27, 28, 29, 30, 31, 32, 33, 34].includes(resourceId)) {
    return { label: "Military", shade: colors.resource.military };
  }
  // Food resources
  else if ([35, 36].includes(resourceId)) {
    return { label: "Food", shade: colors.resource.food };
  }
  // Labor
  else if (resourceId === 23) {
    return { label: "Labor", shade: colors.resource.labor };
  }
  // Transport (Donkey)
  else if (resourceId === 25) {
    return { label: "Transport", shade: colors.resource.transport };
  }
  // Default
  return { label: "Resource", shade: colors.resource.default };
};

// ResourceItem component to handle individual resource items with hover state
const ResourceItem = ({ resourceId, amount }: { resourceId: number; amount: number }) => {
  const [isHovered, setIsHovered] = useState(false);
  const resourceName = resourceIdToName[resourceId] || `Resource ${resourceId}`;
  const category = getResourceCategory(resourceId);

  return (
    <div
      style={{
        ...resource.itemStyle,
        backgroundColor: isHovered ? colors.background.medium : colors.background.light,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Category indicator at top of item */}
      <div
        style={{
          ...resource.indicatorStyle,
          backgroundColor: category.shade,
          opacity: isHovered ? 1 : 0.7,
        }}
      ></div>

      {/* Category label in top right */}
      <div style={resource.labelStyle}>{category.label}</div>

      <div style={{ marginRight: "0.75rem" }}>
        <ResourceIcon name={resourceName} id={resourceId} size="md" />
      </div>

      <div style={{ flexGrow: 1, paddingTop: "0.5rem" }}>
        <div style={resource.nameStyle}>{resourceName}</div>
        <div style={resource.amountStyle}>{formatNumber(amount)}</div>
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
    (acc, { resource: resourceId, amount }) => {
      const category = getResourceCategory(resourceId).label;

      if (!acc[category]) {
        acc[category] = {
          total: 0,
          items: [],
        };
      }

      acc[category].total += amount;
      acc[category].items.push({ resource: resourceId, amount });

      return acc;
    },
    {} as Record<string, { total: number; items: { resource: number; amount: number }[] }>,
  );

  return (
    <div style={section.wrapper}>
      <div style={section.subtitle}>Starting Resources for {structureType}</div>

      <div style={resource.gridStyle}>
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
        <div style={resource.summaryContainerStyle}>
          <div style={resource.summaryTitleStyle}>Resource Summary</div>
          <div style={resource.summaryGridStyle}>
            {Object.entries(resourceTotals).map(([category, data], index) => {
              // Get the shade for this category (always gold/amber now)
              const goldShade = colors.primary;

              return (
                <div key={index} style={resource.summaryCategoryStyle}>
                  <div style={resource.categoryTitleStyle}>
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
                  <div style={resource.totalStyle}>{formatNumber(data.total)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
