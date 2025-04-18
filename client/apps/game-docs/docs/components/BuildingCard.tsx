import { ETERNUM_CONFIG } from "@/utils/config";
import { BuildingType } from "@bibliothecadao/types";
import BuildingCosts from "./BuildingCosts";

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

export default function BuildingCard({ title, image, buildingType, description, multipleImages }: BuildingCardProps) {
  const population = ETERNUM_CONFIG().buildings.buildingPopulation[buildingType] || 0;
  const populationCapacity = ETERNUM_CONFIG().buildings.buildingCapacity[buildingType] || 0;

  const cardStyle = {
    padding: "1.5rem",
    marginBottom: "1.5rem",
    borderRadius: "0.5rem",
    border: "2px solid #8b5a2b",
    backgroundColor: "rgba(40, 30, 20, 0.9)",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.5)",
    transition: "all 0.3s ease",
  };

  const titleStyle = {
    fontSize: "1.5rem",
    fontWeight: "bold",
    marginBottom: "1rem",
    color: "#f6c297",
    borderBottom: "1px solid #8b5a2b",
    paddingBottom: "0.5rem",
  };

  const imageContainerStyle = {
    display: "flex",
    justifyContent: "center",
    marginBottom: "1rem",
  };

  const singleImageStyle = {
    height: "160px",
    objectFit: "contain" as const,
    borderRadius: "0.375rem",
    padding: "0.5rem",
    backgroundColor: "rgba(30, 20, 10, 0.5)",
    border: "1px solid #6d4923",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.4)",
  };

  const populationContainerStyle = {
    marginTop: "0.5rem",
    color: "#e2c5a3",
    padding: "0.5rem",
    backgroundColor: "rgba(20, 15, 10, 0.6)",
    borderRadius: "0.25rem",
  };

  const listStyle = {
    listStyleType: "disc",
    marginLeft: "1rem",
    color: "#e2c5a3",
  };

  const listItemStyle = {
    marginBottom: "0.5rem",
  };

  return (
    <div style={cardStyle} className="building-card">
      <div style={titleStyle}>{title}</div>

      <div style={imageContainerStyle}>
        {multipleImages ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.5rem" }}>
            {(image as ImageType[]).map((img, index) => (
              <img
                key={index}
                src={img.src}
                alt={img.alt}
                style={{ ...singleImageStyle, width: "100%", height: "120px" }}
              />
            ))}
          </div>
        ) : (
          <img src={typeof image === "string" ? image : ""} alt={title} style={singleImageStyle} />
        )}
      </div>

      {(population !== 0 || populationCapacity !== 0) && (
        <div style={populationContainerStyle}>
          {population !== 0 && (
            <div>
              <strong>Population:</strong> +{population}
            </div>
          )}
          {populationCapacity !== 0 && (
            <div>
              <strong>Population Capacity:</strong> +{populationCapacity}
            </div>
          )}
        </div>
      )}

      <BuildingCosts buildingType={buildingType} />

      <ul style={listStyle}>
        {description.map((desc, index) => (
          <li key={index} style={listItemStyle}>
            {desc}
          </li>
        ))}
      </ul>
    </div>
  );
}
