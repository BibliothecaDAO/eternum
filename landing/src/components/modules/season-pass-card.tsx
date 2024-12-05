import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { GetRealmsQuery } from "@/hooks/gql/graphql";
import { RealmMetadata } from "@/types";
import { ResourceIcon } from "../ui/elements/ResourceIcon";

interface SeasonPassCardProps {
  pass: NonNullable<NonNullable<NonNullable<GetRealmsQuery>["tokenBalances"]>["edges"]>[0];
  toggleNftSelection?: (tokenId: string, collectionAddress: string) => void;
  isSelected?: boolean;
  metadata?: RealmMetadata;
}

export const SeasonPassCard = ({ pass, isSelected, toggleNftSelection }: SeasonPassCardProps) => {
  const { tokenId, contractAddress, metadata } = pass!.node?.tokenMetadata ?? {};

  const handleCardClick = () => {
    if (toggleNftSelection) {
      toggleNftSelection(tokenId.toString(), contractAddress ?? "0x");
    }
  };

  const parsedMetadata: RealmMetadata | null = metadata ? JSON.parse(metadata) : null;
  const { attributes, name, image } = parsedMetadata ?? {};

  const realmSettled = false;

  return (
    <Card
      onClick={handleCardClick}
      className={`cursor-pointer transition-all duration-200 hover:border-gold ${isSelected ? "border-gold" : ""}`}
    >
      <img src={image} alt={name} className="w-full object-cover h-auto p-2 rounded-2xl" />
      <CardHeader>
        <CardTitle className=" items-center gap-2">
          <div className="uppercase text-xs mb-2 flex justify-between text-gold/70">
            Season 0 Pass
            {/* {realmSettled ? (
              <div className="text-green">Realm Settled!</div>
            ) : (
              <Button variant={"link"} disabled={true}>
                Start
              </Button>
            )} */}
          </div>
          <div className="flex justify-between gap-2">
            <div className=" text-2xl">{name}</div>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {attributes
            ?.filter((attribute) => attribute.trait_type === "Resource")
            .map((attribute, index) => (
              <ResourceIcon resource={attribute.value as string} size="md" key={`${attribute.trait_type}-${index}`} />
            ))}
        </div>
      </CardContent>
      {attributes?.find((attribute) => attribute.trait_type === "Wonder")?.value && (
        <CardFooter className="!p-2 border-t items-center rounded-b-xl bg-card flex uppercase flex-wrap w-full h-full justify-center text-center">
          {attributes.find((attribute) => attribute.trait_type === "Wonder")?.value}
        </CardFooter>
      )}
    </Card>
  );
};
