import { ClientComponents } from "@/dojo/createClientComponents";
import { currencyFormat } from "@/ui/utils/utils";
import { ResourcesIds } from "@bibliothecadao/eternum";
import { ComponentValue } from "@dojoengine/recs";

export const TroopRow = ({
  troops,
  defending = false,
}: {
  troops: ComponentValue<ClientComponents["Army"]["schema"]["troops"]> | undefined;
  defending?: boolean;
}) => {
  return (
    <div className="self-center m-auto grid grid-cols-3 gap-2 flex">
      <TroopCard
        defending={defending}
        className={`${defending ? "order-last" : ""}`}
        id={ResourcesIds.Crossbowman}
        count={Number(troops?.crossbowman_count || 0)}
      />
      <TroopCard defending={defending} id={ResourcesIds.Paladin} count={Number(troops?.paladin_count || 0)} />
      <TroopCard
        defending={defending}
        className={`${defending ? "order-first" : ""}`}
        id={ResourcesIds.Knight}
        count={Number(troops?.knight_count || 0)}
      />
    </div>
  );
};

const TroopCard = ({
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
      className={`bg-gold/10 text-gold font-bold border-2 border-gradient p-2  hover:bg-gold/40 duration-300${className}`}
    >
      <img
        style={defending ? { transform: "scaleX(-1)" } : {}}
        className="w-[5vw] object-cover mx-auto p-2"
        src={`/images/icons/${id}.png`}
        alt={ResourcesIds[id]}
      />
      <div> {ResourcesIds[id]}</div>
      <div className="text-green">x {currencyFormat(count, 0)}</div>
    </div>
  );
};
