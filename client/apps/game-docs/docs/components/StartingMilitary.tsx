import { ETERNUM_CONFIG } from "@/utils/config";
import { useState } from "react";
import ResourceIcon from "./ResourceIcon";
import { StructureType } from "./StartingResources";
import { colors, formatNumber, resource, section } from "./styles";

type Props = {
  amount: number;
  structureType: StructureType;
};

// Military resource IDs
const militaryResourceIds = [26, 27, 28, 29, 30, 31, 32, 33, 34];

// Military category configuration
const militaryCategory = { label: "Military", shade: colors.resource.military };

const MilitaryResourceItem = ({ amount, structureType }: { amount: number; structureType: StructureType }) => {
  const [isHovered, setIsHovered] = useState(false);
  const resourceName = "Military";

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
        <div style={resource.nameStyle}>{resourceName} T1 units</div>
        <div style={resource.amountStyle}>{formatNumber(amount)} </div>
        <div style={resource.noteStyle}>• {formatNumber(amount - 100)} T1 units in defense slot</div>
        <div style={resource.noteStyle}>• {formatNumber(100)} T1 units in storage</div>

        <div style={resource.noteStyle}>
          Note: The type of troop received depends on the biome that the {structureType.toLowerCase()} is spawned on.
          Starting troops will always have a combat advantage when defending their home.
        </div>
      </div>
    </div>
  );
};

export const StartingMilitary = ({ amount, structureType }: Props) => {
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
          <MilitaryResourceItem key={index} amount={amount} structureType={structureType} />
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
          <strong>Note:</strong> Most of the starting troops are automatically deployed as a guard army in a defensive
          slot, only a handful are provided as tokenized troops in the {structureType.toLowerCase()}’s storage to allow
          for deployment of field armies. and as field troops you can command.
        </div>
      )}
    </div>
  );
};
