import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { GetRealmsQuery } from "@/hooks/gql/graphql";
import { TypeP } from "../typography/type-p";

export interface RealmCardProps {
  realm: NonNullable<NonNullable<NonNullable<GetRealmsQuery>["ercBalance"]>[0]>;
  toggleNftSelection?: (tokenId: string, collectionAddress: string) => void;
  isSelected?: boolean;
}

export const RealmCard = ({
  realm: {
    tokenMetadata: { tokenId, contractAddress },
  },
  isSelected,
  toggleNftSelection,
}: RealmCardProps) => {

  const handleCardClick = () => {
    if (toggleNftSelection) {
      toggleNftSelection(tokenId.toString(), contractAddress ?? "0x");
    }
  };

  return (
    <Card
      onClick={handleCardClick}
      className={`cursor-pointer transition-all duration-200 hover:border-gold ${isSelected ? "border-gold" : ""}`}
    >
      <CardHeader>
        <CardTitle className="flex justify-between items-center gap-2">
          ID: {Number(tokenId)}
          <Checkbox checked={isSelected} />
        </CardTitle>
        <CardDescription>{/*description*/}</CardDescription>
      </CardHeader>
      <CardContent>
        <TypeP>{/*owner*/}Owner</TypeP>
        {/*name && <TypeP>{name}</TypeP>*/}
      </CardContent>
    </Card>
  );
};
