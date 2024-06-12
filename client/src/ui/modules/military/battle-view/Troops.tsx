import { ArmyInfo } from "@/hooks/helpers/useArmies";
import { currencyFormat } from "@/ui/utils/utils";
import { ResourcesIds } from "@bibliothecadao/eternum";
import { useMemo } from "react";

export const TroopRow = ({ army, defending = false }: { army: ArmyInfo; defending?: boolean }) => {
  const noArmy = useMemo(() => !army, [army]);
  return (
    <div className=" grid-cols-3 col-span-3 gap-2 flex ">
      {noArmy ? (
        <div className="text-2xl text-gold  bg-white/10 p-5 border-4 border-gradient">
          Nothing Defending this poor structure. The residents are shaking in terror.
        </div>
      ) : (
        <>
          {" "}
          <TroopCard
            defending={defending}
            className={`${defending ? "order-last" : ""} w-1/3`}
            id={ResourcesIds.Crossbowmen}
            count={army?.troops?.crossbowman_count || 0}
          />
          <TroopCard
            defending={defending}
            className={`w-1/3`}
            id={ResourcesIds.Paladin}
            count={army?.troops?.paladin_count || 0}
          />
          <TroopCard
            defending={defending}
            className={`${defending ? "order-first" : ""} w-1/3`}
            id={ResourcesIds.Knight}
            count={army?.troops?.knight_count || 0}
          />
        </>
      )}
    </div>
  );
};

export const TroopCard = ({
  count,
  id,
  className,
  defending = false,
}: {
  count: number;
  id: ResourcesIds;
  className?: string;
  defending?: boolean;
}) => {
  return (
    <div
      className={` bg-gold/30 text-gold font-bold border-2 border-gradient p-2 clip-angled-sm hover:bg-gold/40 duration-300 ${className}`}
    >
      <img
        style={defending ? { transform: "scaleX(-1)" } : {}}
        className="h-28 object-cover mx-auto p-2"
        src={`/images/icons/${id}.png`}
        alt={ResourcesIds[id]}
      />
      <div> {ResourcesIds[id]}</div>
      <div>x {currencyFormat(count, 0)}</div>
    </div>
  );
};
