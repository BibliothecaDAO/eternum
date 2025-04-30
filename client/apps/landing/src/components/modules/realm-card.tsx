import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { seasonPassAddress } from "@/config";
import { GetAccountTokensQuery } from "@/hooks/gql/graphql";
import { RealmMetadata } from "@/types";
import { useReadContract } from "@starknet-react/core";
import { CheckCircle2, Loader } from "lucide-react";
import { useEffect, useState } from "react";
import { ResourceIcon } from "../ui/elements/resource-icon";

interface RealmCardProps {
  realm: NonNullable<NonNullable<NonNullable<GetAccountTokensQuery>["tokenBalances"]>["edges"]>[0] & {
    seasonPassMinted?: boolean;
  };
  toggleNftSelection?: (tokenId: string, collectionAddress: string) => void;
  isSelected?: boolean;
  metadata?: RealmMetadata;
  onSeasonPassStatusChange?: (tokenId: string, hasMinted: boolean) => void;
}

export const RealmCard = ({ realm, isSelected, toggleNftSelection, onSeasonPassStatusChange }: RealmCardProps) => {
  const { tokenId, contractAddress, metadata } =
    realm.node?.tokenMetadata.__typename === "ERC721__Token"
      ? realm.node.tokenMetadata
      : { tokenId: "", contractAddress: "", metadata: "" };
  const [isError, setIsError] = useState(true);
  const { data, error, isSuccess, refetch, isFetching } = useReadContract({
    abi: [
      {
        type: "function",
        name: "owner_of",
        inputs: [{ name: "token_id", type: "core::integer::u256" }],
        outputs: [{ type: "core::starknet::contract_address::ContractAddress" }],
        state_mutability: "view",
      },
    ] as const,
    functionName: "owner_of",
    address: seasonPassAddress as `0x${string}`,
    args: [tokenId],
    watch: isError ? true : false,
  });

  const handleCardClick = () => {
    if (toggleNftSelection && !isSuccess) {
      toggleNftSelection(tokenId.toString(), contractAddress ?? "0x");
    }
  };

  useEffect(() => {
    if (isSuccess) {
      setIsError(false);
    }
  }, [isSuccess, refetch]);

  useEffect(() => {
    if (isSuccess && onSeasonPassStatusChange && tokenId) {
      onSeasonPassStatusChange(tokenId.toString(), !!data);
    }
  }, [isSuccess, data, tokenId]);

  const parsedMetadata: RealmMetadata | null = metadata ? JSON.parse(metadata) : null;
  const { attributes, name, image } = parsedMetadata ?? {};

  return (
    <Card
      onClick={handleCardClick}
      className={`relative transition-all duration-200 rounded-lg overflow-hidden shadow-md hover:shadow-xl 
        ${isSuccess ? "cursor-not-allowed" : "cursor-pointer hover:ring-1 hover:ring-gold"} 
        ${isSelected ? "ring-2 ring-offset-2 ring-gold/30 scale-[1.02]" : ""} 
        ${!isSuccess && !isFetching && !isSelected ? "ring-1 ring-gold/30 " : ""} 
      `}
    >
      <div
        className={`absolute inset-0 opacity-5 
        ${isFetching ? "bg-gray-500" : isSuccess ? "bg-dark-green" : "bg-enemy"} 
        pointer-events-none`}
      />

      {/* Status Indicator Icon (Top Right) - Remains absolutely positioned */}
      {!isSelected && (
        <div
          className={`absolute top-2 right-2 z-20 p-1 rounded-full bg-card/80 backdrop-blur-sm`}
          title={isFetching ? "Checking Status..." : isSuccess ? "Season Pass Minted" : "Season Pass Not Minted"}
        >
          {isFetching ? (
            <Loader className="w-5 h-5 text-gray-400 animate-spin" />
          ) : isSuccess ? (
            <CheckCircle2 className="w-5 h-5 text-lime-500" />
          ) : (
            ""
          )}
        </div>
      )}

      {/* Prompt to Mint Section (Top of Card) */}

      {/* Main card content starts below the mint prompt */}
      <div className="relative z-10 bg-card/95">
        <div className="relative">
          <img
            src={image}
            alt={name}
            className={`w-full object-cover h-40 sm:h-48 transition-all duration-200 
              ${isSuccess ? "opacity-50 filter grayscale brightness-75" : "opacity-90 hover:opacity-100"}
            `}
          />
          {isSelected && (
            <div className="absolute top-2 right-2 bg-gold text-background px-2 py-0.5 rounded-md text-xs z-20">
              Selected
            </div>
          )}
        </div>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="items-center gap-2">
            <div className="flex justify-between gap-2">
              <h5 className="text-xl">{name}</h5>
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
      </div>

      {!isSuccess && !isSelected && !isFetching && (
        <div className="bg-gold/30 text-xs uppercase text-center p-2">Select</div>
      )}
    </Card>
  );
};
