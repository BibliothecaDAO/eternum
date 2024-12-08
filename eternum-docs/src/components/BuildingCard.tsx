import { BuildingType } from "@bibliothecadao/eternum";
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
  return (
    <div className="p-6 mb-6 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/5">
      <h4 className="text-xl font-bold mb-4">{title}</h4>

      {multipleImages ? (
        <div className="flex mb-4">
          {(image as ImageType[]).map((img, index) => (
            <img key={index} src={img.src} alt={img.alt} width="200" />
          ))}
        </div>
      ) : (
        <img src={typeof image === "string" ? image : ""} alt={title} width="300" className="float-right" />
      )}

      <BuildingCosts buildingType={buildingType} />

      <ul className="list-disc ml-4 mt-2">
        {description.map((desc, index) => (
          <li key={index}>{desc}</li>
        ))}
      </ul>
    </div>
  );
}
