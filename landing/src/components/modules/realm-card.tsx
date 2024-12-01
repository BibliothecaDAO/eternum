import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GetRealmsQuery } from "@/hooks/gql/graphql";
import { RealmMetadata } from "@/types";
import { Checkbox } from "../ui/checkbox";
import { ResourceIcon } from "../ui/elements/ResourceIcon";

export interface RealmCardProps {
  realm: NonNullable<NonNullable<NonNullable<GetRealmsQuery>["tokenBalances"]>["edges"]>[0] & {
    seasonPassMinted?: boolean;
  };
  toggleNftSelection?: (tokenId: string, collectionAddress: string) => void;
  isSelected?: boolean;
  seasonPassMinted?: boolean;
  metadata?: RealmMetadata;
}

export const RealmCard = ({ realm, isSelected, seasonPassMinted, toggleNftSelection }: RealmCardProps) => {
  const { tokenId, contractAddress, metadata } = realm.node?.tokenMetadata ?? {};

  const handleCardClick = () => {
    if (toggleNftSelection && !seasonPassMinted) {
      toggleNftSelection(tokenId.toString(), contractAddress ?? "0x");
    }
  };

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
              {seasonPassMinted ? (
                <div className="text-green">Pass Minted!</div>
              ) : (
                <div className="flex items-center gap-2">
                  Mint: <Checkbox checked={isSelected} disabled={seasonPassMinted} />
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-between gap-2">
            <div className=" text-3xl">{name}</div>
          </div>
        </CardTitle>
        <CardDescription>{/*description*/}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {attributes
            ?.filter((attribute) => attribute.trait_type === "Resource")
            .map((attribute, index) => (
              <ResourceIcon resource={attribute.value as string} size="lg" key={`${attribute.trait_type}-${index}`} />
            ))}
        </div>
        {/* {Number(tokenId)} */}
      </CardContent>
    </Card>
  );
};
