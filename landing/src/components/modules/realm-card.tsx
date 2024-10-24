import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { GetRealmsQuery } from "@/hooks/gql";
import { useState } from "react";
import { TypeP } from "../typography/type-p";

export interface Realm {
  title: string;
  checked?: boolean;
  owner?: string;
  name?: string;
}

export const RealmCard = ({ tokenMetadata, description, checked: initialChecked, owner, name }: NonNullable<NonNullable<NonNullable<GetRealmsQuery>["ercBalance"]>[0]>) => {
  const [isChecked, setIsChecked] = useState(initialChecked);

  const handleCardClick = () => {
    const newCheckedState = !isChecked;
    setIsChecked(newCheckedState);
  };

  return (
    <Card
      onClick={handleCardClick}
      className={`cursor-pointer transition-all duration-200 hover:border-gold ${isChecked ? "border-gold" : ""}`}
    >
      <CardHeader>
        <CardTitle className="flex justify-between items-center gap-2">
          ID: {Number(tokenMetadata.tokenId)}
          <Checkbox checked={isChecked} />
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <TypeP>{owner}</TypeP>
        {name && <TypeP>{name}</TypeP>}
      </CardContent>
    </Card>
  );
};
