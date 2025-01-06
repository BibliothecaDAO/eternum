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
    <div className="self-center m-auto grid grid-cols-3 gap-2">
      <TroopCard
        defending={defending}
        className={`${defending ? "" : ""}`}
        id={ResourcesIds.Crossbowman}
        count={Number(troops?.crossbowman_count || 0)}
      />
      <TroopCard
        defending={defending}
        className={`${defending ? "" : ""}`}
        id={ResourcesIds.Knight}
        count={Number(troops?.knight_count || 0)}
      />
      <TroopCard
        defending={defending}
        className={`${defending ? "" : ""}`}
        id={ResourcesIds.Paladin}
        count={Number(troops?.paladin_count || 0)}
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
    <div className={`bg-gold/10 text-gold rounded-xl p-4  hover:bg-gold/40 duration-300${className}`}>
      <img
        className={`w-[6vw] object-cover transform mx-auto p-2  ${!defending ? "scale-x-[-1]" : ""}`}
        src={`/images/icons/${id}.png`}
        alt={ResourcesIds[id]}
      />
      <h4 className="truncate"> {ResourcesIds[id]}</h4>
      <div className="text-green">x {currencyFormat(count, 0)}</div>
    </div>
  );
};
