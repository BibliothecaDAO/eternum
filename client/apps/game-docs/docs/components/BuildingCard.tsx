import { ETERNUM_CONFIG } from "@/utils/config";
import { BuildingType, resources } from "@bibliothecadao/types";
import BuildingCosts from "./BuildingCosts";
import ResourceIcon from "./ResourceIcon";
import { colors } from "./styles";

interface ImageType {
  src: string;
  alt: string;
}

interface BuildingCardProps {
  title: string;
  image: string | ImageType[];
  buildingType: BuildingType;
  description: string[];
  multipleImages?: boolean;
}

export default function BuildingCard({ title, image, buildingType, description }: BuildingCardProps) {
  const population = ETERNUM_CONFIG().buildings.buildingPopulation[buildingType] || 0;
  let populationCapacity = ETERNUM_CONFIG().buildings.buildingCapacity[buildingType] || 0;
  const isLaborBuilding = buildingType === BuildingType.ResourceLabor;
  if (isLaborBuilding) {
    populationCapacity = ETERNUM_CONFIG().populationCapacity.basePopulation;
  }

  // Determine if this building produces a resource
  const isResourceBuilding = buildingType !== BuildingType.WorkersHut && buildingType !== BuildingType.Storehouse;

  // Get the resource ID for resource buildings
  const getResourceId = () => {
    if (!isResourceBuilding) return undefined;

    // For resource buildings, the resource ID is the building type - 2
    // This maps BuildingType.ResourceStone (3) to resource ID 1, etc.
    return buildingType - 2;
  };

  const resourceId = getResourceId();
  const resourceName = resourceId ? resources.find((r) => r.id === resourceId)?.trait || "" : "";

  const styles = {
    card: {
      padding: "0.75rem",
      marginBottom: "1rem",
      borderRadius: "0.375rem",
      border: `1px solid #8b5a2b`,
      backgroundColor: colors.background.dark,
    },
    header: {
      display: "flex",
      justifyContent: "space-between",
      marginBottom: "0.5rem",
      borderBottom: `1px solid ${colors.borderDark}`,
      paddingBottom: "0.25rem",
    },
    titleContainer: {
      display: "flex",
      alignItems: "center",
      gap: "0.5rem",
      fontWeight: "bold",
      color: "#f6c297",
    },
    content: {
      display: "flex",
      gap: "0.75rem",
    },
    image: {
      width: "80px",
      height: "80px",
      objectFit: "contain" as const,
      padding: "0.25rem",
      backgroundColor: colors.background.light,
      border: `1px solid ${colors.borderDark}`,
      borderRadius: "0.25rem",
    },
    info: {
      flex: 1,
      fontSize: "0.875rem",
    },
    stats: {
      display: "flex",
      gap: "0.5rem",
      marginBottom: "0.5rem",
    },
    stat: {
      padding: "0.25rem 0.5rem",
      backgroundColor: colors.background.dark,
      borderRadius: "0.25rem",
      fontSize: "0.75rem",
    },
    desc: {
      fontSize: "0.8rem",
      color: colors.secondary,
      marginBottom: "0.5rem",
    },
  };

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <div style={styles.titleContainer}>
          {resourceId && <ResourceIcon id={resourceId} name={resourceName} size="lg" />}
          {title}
        </div>
        <div style={{ fontSize: "0.75rem", color: "#a89986" }}>ID: {buildingType}</div>
      </div>

      <div style={styles.content}>
        <img src={typeof image === "string" ? image : ""} alt={title} style={styles.image} />

        <div style={styles.info}>
          <div style={styles.stats}>
            {population > 0 && <div style={styles.stat}>Pop Req: {population}</div>}
            {populationCapacity > 0 && <div style={styles.stat}>Pop Cap: +6</div>}
          </div>

          <ul style={{ listStyleType: "disc", marginLeft: "1rem", marginBottom: "0.5rem" }}>
            {description.map((desc, index) => (
              <li key={index} style={styles.desc}>
                {desc}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <BuildingCosts buildingType={buildingType} />
    </div>
  );
}
