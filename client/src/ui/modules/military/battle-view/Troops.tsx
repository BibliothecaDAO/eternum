import { currencyFormat } from "@/ui/utils/utils";
import { ResourcesIds, Troops } from "@bibliothecadao/eternum";

export const TroopRow = ({ troops, defending = false }: { troops: Troops | undefined; defending?: boolean }) => {
  return (
    <div className="self-center m-auto grid-cols-3 gap-2 flex">
      <TroopCard
        defending={defending}
        className={`${defending ? "order-last" : ""} w-1/3`}
        id={ResourcesIds.Crossbowmen}
        count={Number(troops?.crossbowman_count || 0)}
      />
      <TroopCard
        defending={defending}
        className={`w-1/3`}
        id={ResourcesIds.Paladin}
        count={Number(troops?.paladin_count || 0)}
      />
      <TroopCard
        defending={defending}
        className={`${defending ? "order-first" : ""} w-1/3`}
        id={ResourcesIds.Knight}
        count={Number(troops?.knight_count || 0)}
      />
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
      className={`bg-gold/10 text-gold font-bold border-2 border-gradient p-2 clip-angled-sm hover:bg-gold/40 duration-300 h-[20vh]${className}`}
    >
      <img
        style={defending ? { transform: "scaleX(-1)" } : {}}
        className="h-[10vh] object-cover mx-auto p-2"
        src={`/images/icons/${id}.png`}
        alt={ResourcesIds[id]}
      />
      <div> {ResourcesIds[id]}</div>
      <div className="text-green">x {currencyFormat(count, 0)}</div>
    </div>
  );
};
