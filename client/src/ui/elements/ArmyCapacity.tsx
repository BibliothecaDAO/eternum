import { ArmyInfo } from "@/hooks/helpers/useArmies";
import { EternumGlobalConfig } from "@bibliothecadao/eternum";
import clsx from "clsx";

export const ArmyCapacity = ({ army, className }: { army: ArmyInfo; className?: string }) => {
  return (
    <div
      className={clsx(
        army.capacity - army.weight < EternumGlobalConfig.exploration.reward ? "text-red" : "",
        className,
      )}
    >
      Capacity : {army.weight} / {army.capacity}
    </div>
  );
};
