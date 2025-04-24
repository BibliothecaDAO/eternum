import { ETERNUM_CONFIG } from "@/utils/config";
import { useState } from "react";
import ResourceIcon from "./ResourceIcon";
import { StructureType } from "./StartingResources";
import { colors, resource, section } from "./styles";

type Props = {
  structureType: StructureType;
};

// Military resource IDs
const militaryResourceIds = [26, 27, 28, 29, 30, 31, 32, 33, 34];

// Military category configuration
const militaryCategory = { label: "Military", shade: colors.resource.military };

const MilitaryResourceItem = ({ amount }: { amount: number }) => {
  const [isHovered, setIsHovered] = useState(false);
  const resourceName = "Military";
  const roundedAmount = amount + 1;

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
          backgroundColor: militaryCategory.shade,
          opacity: isHovered ? 1 : 0.7,
        }}
      ></div>

      {/* Category label in top right */}
      <div style={resource.labelStyle}>{militaryCategory.label}</div>

      <div style={{ marginRight: "0.75rem" }}>
        <ResourceIcon name={resourceName} id={26} size="md" />
      </div>

      <div style={{ flexGrow: 1, paddingTop: "0.5rem" }}>
        <div style={resource.nameStyle}>{resourceName}</div>
        {/* <div style={resource.amountStyle}>{formatNumber(roundedAmount * 2)}</div> */}
        {/* <div style={resource.noteStyle}>• {formatNumber(roundedAmount)} units as guards</div> */}
        {/* <div style={resource.noteStyle}>• {formatNumber(roundedAmount)} units as field troops</div> */}
        <div style={resource.amountStyle}>[REDACTED]</div>

        <div style={resource.noteStyle}>Note: Troop type depends on realm biome</div>
      </div>
    </div>
  );
};

export const StartingMilitary = ({ structureType }: Props) => {
  const config = ETERNUM_CONFIG();
  const allStartingResources =
    structureType === StructureType.Village ? config.villageStartingResources : config.startingResources;

  // Filter only military resources
  const militaryResources = allStartingResources.filter(({ resource: resourceId }) =>
    militaryResourceIds.includes(resourceId),
  );

  // Total military units
  const totalMilitary = militaryResources.reduce((acc, { amount }) => acc + amount, 0);

  // Group military resources together
  const processedMilitary = militaryResources.reduce(
    (acc, { resource: resourceId, amount }) => {
      // Find if we already have a combined military entry
      const militaryIndex = acc.findIndex((item) => item.category === "Combined");
      if (militaryIndex >= 0) {
        // Add to existing military total
        acc[militaryIndex].amount += amount;
      } else {
        // Create new military entry (using Knight ID as placeholder)
        acc.push({
          resource: 26,
          amount,
          category: "Combined",
        });
      }
      return acc;
    },
    [] as Array<{ resource: number; amount: number; category: string }>,
  );

  return (
    <div style={section.wrapper}>
      <div style={section.subtitle}>Starting Military for {structureType}</div>

      <div style={{ ...resource.gridStyle, gridTemplateColumns: "1fr" }}>
        {processedMilitary.map((item, index) => (
          <MilitaryResourceItem key={index} amount={item.amount} />
        ))}
      </div>

      {militaryResources.length === 0 && (
        <div style={{ textAlign: "center", padding: "2rem", color: "#9ca3af" }}>
          No starting military units defined for {structureType}
        </div>
      )}

      {totalMilitary > 0 && (
        <div
          style={{
            marginTop: "1rem",
            padding: "1rem",
            backgroundColor: colors.background.light,
            borderRadius: "0.5rem",
            fontSize: "0.9rem",
            color: "#9ca3af",
          }}
        >
          <strong>Note:</strong> Military units will appear as both guards protecting your {structureType.toLowerCase()}{" "}
          and as field troops you can command.
        </div>
      )}
    </div>
  );
};
