import { RealmInfo as RealmInfoType } from "@bibliothecadao/eternum";
import { FC, useState } from "react";

interface LaborProductionControlsProps {
  realm: RealmInfoType;
  productionAmount: number;
  setProductionAmount: (value: number) => void;
  handleProduce: () => void;
  ticks: number | undefined;
  setTicks: (value: number) => void;
  isLoading: boolean;
}

export const LaborProductionControls: FC<LaborProductionControlsProps> = ({
  realm,
  productionAmount,
  setProductionAmount,
  handleProduce,
  ticks,
  setTicks,
  isLoading,
}) => {
  const [selectedLaborResource, setSelectedLaborResource] = useState<number | null>(null);

  return (
    <div className="bg-brown/20 p-4 rounded-lg">
      <h3 className="text-2xl font-bold mb-4">Labor Production</h3>

      {/* ... existing labor production controls code ... */}
    </div>
  );
};
