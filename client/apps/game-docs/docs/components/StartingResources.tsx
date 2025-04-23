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
};

// Get resource category label
const getResourceCategory = (resourceId: number): { label: string; shade: string } => {
  // Food resources
  if ([35, 36].includes(resourceId)) {
    return { label: "Food", shade: colors.resource.food };
  }
  // Labor
  else if (resourceId === 23) {
    return { label: "Labor", shade: colors.resource.labor };
  }
  // Transport (Donkey)
  else if (resourceId === 25) {
    return { label: "Donkey", shade: colors.resource.transport };
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
  const allStartingResources =
    structureType === StructureType.Village ? config.villageStartingResources : config.startingResources;

  // Filter out military resources
  const startingResources = allStartingResources.filter(
    ({ resource: resourceId }) => ![26, 27, 28, 29, 30, 31, 32, 33, 34].includes(resourceId),
  );

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
    </div>
  );
};
