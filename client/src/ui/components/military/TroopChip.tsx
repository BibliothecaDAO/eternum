import { ClientComponents } from "@/dojo/createClientComponents";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import { currencyFormat } from "@/ui/utils/utils";
import { ComponentValue } from "@dojoengine/recs";

export const TroopMenuRow = ({
  troops,
  className,
}: {
  troops: ComponentValue<ClientComponents["Army"]["schema"]["troops"]> | undefined;
  className?: string;
}) => {
  return (
    <div className={`grid grid-cols-3 gap-2 relative w-full text-gold font-bold ${className}`}>
      <div className="px-2 py-1 bg-gold/10  flex flex-col justify-between gap-2 border border-gold/10">
        <ResourceIcon withTooltip={false} resource={"Crossbowman"} size="lg" />
        <div className="text-green text-xs self-center">
          {currencyFormat(Number(troops?.crossbowman_count || 0), 0)}
        </div>
      </div>
      <div className="px-2 py-1 bg-gold/10  flex flex-col justify-between gap-2 border border-gold/10">
        <ResourceIcon withTooltip={false} resource={"Knight"} size="lg" />
        <div className="text-green text-xs self-center">{currencyFormat(Number(troops?.knight_count || 0), 0)}</div>
      </div>
      <div className="px-2 py-1 bg-gold/10  flex flex-col justify-between gap-2 border border-gold/10">
        <ResourceIcon withTooltip={false} resource={"Paladin"} size="lg" />
        <div className="text-green text-xs self-center">{currencyFormat(Number(troops?.paladin_count || 0), 0)}</div>
      </div>
    </div>
  );
};
