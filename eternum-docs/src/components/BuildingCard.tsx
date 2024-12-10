import { BUILDING_CAPACITY, BuildingType } from "@bibliothecadao/eternum";
import BuildingCosts from "./BuildingCosts";
import { BUILDING_POPULATION } from "@bibliothecadao/eternum";

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
  const population = BUILDING_POPULATION[buildingType] || 0;
  const populationCapacity = BUILDING_CAPACITY[buildingType] || 0;

  return (
    <div className="p-6 mb-6 rounded-lg border border-gray-700 bg-white/5">
      <div className="text-xl font-bold mb-4">{title}</div>

      {multipleImages ? (
        <div className="grid grid-cols-2 mb-4">
          {(image as ImageType[]).map((img, index) => (
            <img key={index} src={img.src} alt={img.alt} width="250" />
          ))}
        </div>
      ) : (
        <img src={typeof image === "string" ? image : ""} alt={title} width="250" className="float-right" />
      )}

      {(population !== 0 || populationCapacity !== 0) && (
        <div className="mt-2 text-md text-gray-300">
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

      <ul className="list-disc ml-4">
        {description.map((desc, index) => (
          <li key={index}>{desc}</li>
        ))}
      </ul>
    </div>
  );
}
