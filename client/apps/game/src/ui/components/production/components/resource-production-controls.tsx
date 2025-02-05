import { RealmInfo as RealmInfoType } from "@bibliothecadao/eternum";
import { FC } from "react";

interface ResourceProductionControlsProps {
  selectedResource: number;
  useRawResources: boolean;
  setUseRawResources: (value: boolean) => void;
  productionAmount: number;
  setProductionAmount: (value: number) => void;
  handleProduce: () => void;
  realm: RealmInfoType;
  ticks: number | undefined;
  setTicks: (value: number) => void;
  isLoading: boolean;
}

export const ResourceProductionControls: FC<ResourceProductionControlsProps> = ({
  selectedResource,
  useRawResources,
  setUseRawResources,
  productionAmount,
  setProductionAmount,
  handleProduce,
  realm,
  ticks,
  setTicks,
  isLoading,
}) => {
  // ... existing resource production controls code ...
};
