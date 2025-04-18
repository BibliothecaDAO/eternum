import { ETERNUM_CONFIG } from "@/utils/config";
import { BuildingType, resources } from "@bibliothecadao/types";
import BuildingCosts from "./BuildingCosts";
import ResourceIcon from "./ResourceIcon";

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
  const populationCapacity = ETERNUM_CONFIG().buildings.buildingCapacity[buildingType] || 0;

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

  const cardStyle = {
    padding: "0.75rem",
    marginBottom: "1rem",
    borderRadius: "0.375rem",
    border: "1px solid #8b5a2b",
    backgroundColor: "rgba(40, 30, 20, 0.9)",
  };

  const headerStyle = {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "0.5rem",
    borderBottom: "1px solid #6d4923",
    paddingBottom: "0.25rem",
  };

  const titleContainerStyle = {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    fontWeight: "bold",
    color: "#f6c297",
  };

  const contentStyle = {
    display: "flex",
    gap: "0.75rem",
  };

  const imageStyle = {
    width: "80px",
    height: "80px",
    objectFit: "contain" as const,
    padding: "0.25rem",
    backgroundColor: "rgba(30, 20, 10, 0.5)",
    border: "1px solid #6d4923",
    borderRadius: "0.25rem",
  };

  const infoStyle = {
    flex: 1,
    fontSize: "0.875rem",
  };

  const statsStyle = {
    display: "flex",
    gap: "0.5rem",
    marginBottom: "0.5rem",
  };

  const statStyle = {
    padding: "0.25rem 0.5rem",
    backgroundColor: "rgba(40, 30, 20, 0.7)",
    borderRadius: "0.25rem",
    fontSize: "0.75rem",
  };

  const descStyle = {
    fontSize: "0.8rem",
    color: "#e2c5a3",
    marginBottom: "0.5rem",
  };

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <div style={titleContainerStyle}>
          {resourceId && <ResourceIcon id={resourceId} name={resourceName} size="lg" />}
          {title}
        </div>
        <div style={{ fontSize: "0.75rem", color: "#a89986" }}>ID: {buildingType}</div>
      </div>

      <div style={contentStyle}>
        <img src={typeof image === "string" ? image : ""} alt={title} style={imageStyle} />

        <div style={infoStyle}>
          <div style={statsStyle}>
            {population > 0 && <div style={statStyle}>Pop: +{population}</div>}
            {populationCapacity > 0 && <div style={statStyle}>Cap: +{populationCapacity}</div>}
          </div>

          <ul style={{ listStyleType: "disc", marginLeft: "1rem", marginBottom: "0.5rem" }}>
            {description.map((desc, index) => (
              <li key={index} style={descStyle}>
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
