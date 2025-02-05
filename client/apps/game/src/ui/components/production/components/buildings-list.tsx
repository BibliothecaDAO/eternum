import { RealmInfo as RealmInfoType } from "@bibliothecadao/eternum";
import { FC } from "react";

interface BuildingsListProps {
  realm: RealmInfoType;
  onSelectProduction: (resource: number) => void;
  selectedResource: number | null;
}

export const BuildingsList: FC<BuildingsListProps> = ({ realm, onSelectProduction, selectedResource }) => {
  // ... existing BuildingsList code ...
};
