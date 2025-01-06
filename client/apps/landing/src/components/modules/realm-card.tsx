import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { seasonPassAddress } from "@/config";
import { GetAccountTokensQuery } from "@/hooks/gql/graphql";
import { RealmMetadata } from "@/types";
import { useReadContract } from "@starknet-react/core";
import { Loader } from "lucide-react";
import { useEffect, useState } from "react";
import { Checkbox } from "../ui/checkbox";
import { ResourceIcon } from "../ui/elements/ResourceIcon";
export interface RealmCardProps {
  realm: NonNullable<NonNullable<NonNullable<GetAccountTokensQuery>["tokenBalances"]>["edges"]>[0] & {
    seasonPassMinted?: boolean;
  };
  toggleNftSelection?: (tokenId: string, collectionAddress: string) => void;
  isSelected?: boolean;
  metadata?: RealmMetadata;
  onSeasonPassStatusChange?: (tokenId: string, hasMinted: boolean) => void;
}

export const RealmCard = ({ realm, isSelected, toggleNftSelection, onSeasonPassStatusChange }: RealmCardProps) => {
  const { tokenId, contractAddress, metadata } = realm.node?.tokenMetadata ?? {};
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
    address: seasonPassAddress,
    args: [tokenId],
    watch: isError ? true : false,
  });

  const handleCardClick = () => {
    if (toggleNftSelection && !data) {
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
  }, [isSuccess, data, tokenId, onSeasonPassStatusChange]);

  const parsedMetadata: RealmMetadata | null = metadata ? JSON.parse(metadata) : null;
  const { attributes, name, image } = parsedMetadata ?? {};

  return (
    <Card
      onClick={handleCardClick}
      className={`cursor-pointer transition-all duration-200 hover:border-gold ${isSelected ? "border-gold" : ""}`}
    >
      <img src={image} alt={name} className="w-full object-cover h-24 p-2 rounded-2xl" />
      <CardHeader>
        <CardTitle className=" items-center gap-2">
          <div className="uppercase text-sm mb-2 flex justify-between">
            Realm
            <div className="flex items-center gap-2 text-sm">
              {isFetching && <Loader className="animate-spin" />}
              {error ? (
                <div className="flex items-center gap-2">
                  Mint: <Checkbox checked={isSelected} disabled={isSuccess} />
                </div>
              ) : (
                isSuccess && <div className="text-green">Pass Minted!</div>
              )}
            </div>
          </div>
          <div className="flex justify-between gap-2">
            <div className=" text-2xl">{name}</div>
          </div>
        </CardTitle>
        <CardDescription>{/*description*/}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {attributes
            ?.filter((attribute) => attribute.trait_type === "Resource")
            .map((attribute, index) => (
              <ResourceIcon resource={attribute.value as string} size="md" key={`${attribute.trait_type}-${index}`} />
            ))}
        </div>

        {/* {Number(tokenId)} */}
      </CardContent>
      {attributes?.find((attribute) => attribute.trait_type === "Wonder")?.value && (
        <CardFooter className="!p-2 border-t items-center rounded-b-xl bg-card flex uppercase flex-wrap w-full h-full justify-center text-center">
          {attributes.find((attribute) => attribute.trait_type === "Wonder")?.value}
        </CardFooter>
      )}
    </Card>
  );
};
