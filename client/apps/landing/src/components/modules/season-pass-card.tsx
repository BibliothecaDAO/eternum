import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { TokenBalance } from "@/routes/season-passes.lazy";
import { RealmMetadata } from "@/types";
import { ResourceIcon } from "../ui/elements/resource-icon";

interface SeasonPassCardProps {
  pass: TokenBalance;
  toggleNftSelection?: (tokenId: string, collectionAddress: string) => void;
  isSelected?: boolean;
  metadata?: RealmMetadata;
}

export const SeasonPassCard = ({ pass, isSelected, toggleNftSelection }: SeasonPassCardProps) => {
  const { tokenId, contractAddress, metadata } =
    pass?.node?.tokenMetadata.__typename === "ERC721__Token"
      ? pass.node.tokenMetadata
      : { tokenId: "", contractAddress: "", metadata: "" };

  const handleCardClick = () => {
    if (toggleNftSelection) {
      toggleNftSelection(tokenId.toString(), contractAddress ?? "0x");
    }
  };

  const parsedMetadata: RealmMetadata | null = metadata ? JSON.parse(metadata) : null;
  const { attributes, name, image } = parsedMetadata ?? {};

  return (
    <Card
      onClick={handleCardClick}
      className={`relative transition-all duration-200 rounded-lg overflow-hidden shadow-md hover:shadow-xl 
        ${isSelected ? "ring-2 ring-offset-2 ring-gold scale-[1.02]" : "hover:ring-1 hover:ring-gold"} 
        cursor-pointer
      `}
    >
      {/* Prompt to Manage Section (Top of Card) - REMOVED */}
      {/* <div className="bg-gradient-to-r from-blue-50 to-blue-100 text-blue-800 text-xs font-semibold p-2 text-center border-b border-blue-200/50">
        Click card to manage
      </div> */}

      {/* Main card content starts below the manage prompt */}
      {/* <div className="relative z-10 bg-card/95"> */}
      <div className="relative">
        <img 
          src={image} 
          alt={name} 
          className="w-full object-cover h-56 sm:h-64 opacity-90 hover:opacity-100 transition-all duration-200"
        />
        {isSelected && (
          <div className="absolute top-2 right-2 bg-gold text-background px-2 py-0.5 rounded-md text-xs font-bold z-20">
            Selected
          </div>
        )}
      </div>
      <CardHeader className="p-4 pb-2">
        <CardTitle className=" items-center gap-2">
          <div className="uppercase text-xs tracking-wider mb-1 flex justify-between items-center text-gray-400">
            Season 1 Pass
          </div>
          <div className="flex justify-between gap-2">
            <div className="text-2xl font-bold">{name}</div>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-2">
        <div className="flex flex-wrap gap-2 mb-2">
          {attributes
            ?.filter((attribute) => attribute.trait_type === "Resource")
            .map((attribute, index) => (
              <ResourceIcon resource={attribute.value as string} size="sm" key={`${attribute.trait_type}-${index}`} />
            ))}
        </div>
      </CardContent>
      {attributes?.find((attribute) => attribute.trait_type === "Wonder")?.value && (
        <CardFooter className="border-t items-center bg-card/50 flex uppercase flex-wrap w-full h-full justify-center text-center p-3 text-sm">
          <span className="text-gold font-bold tracking-wide">
             {attributes.find((attribute) => attribute.trait_type === "Wonder")?.value}
          </span>
        </CardFooter>
      )}
      {/* </div> */}
    </Card>
  );
};
