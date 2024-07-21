import { ArmyInfo } from "@/hooks/helpers/useArmies";
import { EternumGlobalConfig } from "@bibliothecadao/eternum";
import clsx from "clsx";

export const ArmyCapacity = ({ army, className }: { army: ArmyInfo; className?: string }) => {
  return (
    <div
      className={clsx(
        (army.capacity?.weight_gram || 0n) - (army.weight?.value || 0n) < BigInt(EternumGlobalConfig.exploration.reward)
          ? "text-red"
          : "",
        className,
      )}
    >
      Capacity : {Number(army.weight?.value)} / {Number(army.capacity?.weight_gram)}
    </div>
  );
};
