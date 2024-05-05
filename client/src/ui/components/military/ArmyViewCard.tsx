import { ArmyAndName } from "@/hooks/helpers/useArmies";
import { Headline } from "@/ui/elements/Headline";
import { currencyFormat } from "@/ui/utils/utils";
import { InventoryResources } from "../resources/InventoryResources";
import { getRealmNameById } from "@/ui/utils/realms";
import { OrderIcon } from "@/ui/elements/OrderIcon";
import { orderNameDict } from "@bibliothecadao/eternum";

export const ArmyViewCard = ({
  army,
  onClick,
  active,
  actions,
}: {
  army: ArmyAndName;
  onClick?: (entityId: string) => void;
  active?: boolean;
  actions?: boolean;
}) => {
  const handleToggle = (id: string) => {
    if (onClick) {
      if (active) {
        return onClick("");
      }
      onClick(id);
    }
  };

  return (
    <div
      onClick={() => (onClick ? handleToggle(army.entity_id.toString()) : null)}
      className={`group hover:bg-gold/10  border relative ${active ? "bg-gold text-brown animate-pulse" : ""}`}
    >
      <div className="flex">
        <div className="flex items-center p-1  border-t-0 border-l-0  border pr-3 h5">
          {army.realm.order && <OrderIcon order={orderNameDict[army.realm.order]} size="xs" className="mr-1" />}
          {getRealmNameById(BigInt(army.realm.realm_id))}
        </div>
      </div>

      {actions && (
        <div className="absolute bg-gold top-0 left-0 w-full h-full text-brown flex justify-center group-hover:visible invisible z-10">
          <div className="self-center uppercase">open actions</div>
        </div>
      )}

      <div className="p-2">
        {" "}
        <Headline>
          <h6 className="p-2">{army.name}</h6>
        </Headline>
        <div className="my-2">
          <span>HP: </span>
          {Number(army.current?.toString()) / 1000}
        </div>
        {/* <div className="flex justify-between w-full">
          <span>{army.battle_id ? army.battle_id : "No battle"}</span>
          <span> {army.battle_side ? army.battle_side : "idle"}</span>
        </div> */}
        {/* <div>{army.battle_side ? army.battle_side : "idle"}</div> */}
        <div className="flex flex-col space-y-2 ">
          <div className="flex border">
            <div className="w-8 h-8 border flex self-center justify-center bg-gold text-brown">
              <div>{currencyFormat(army.troops.crossbowman_count, 0)}</div>
            </div>
            <div className="self-center px-2">Crossbowmen</div>
          </div>
          <div className="flex border">
            <div className="w-8 h-8 border flex self-center justify-center bg-gold text-brown">
              <div>{currencyFormat(army.troops.knight_count, 0)}</div>
            </div>
            <div className="self-center px-2">Knights</div>
          </div>
          <div className="flex border">
            <div className="w-8 h-8 border flex self-center justify-center bg-gold text-brown">
              <div>{currencyFormat(army.troops.paladin_count, 0)}</div>
            </div>
            <div className="self-center px-2">Paladins</div>
          </div>
        </div>
        <InventoryResources entityId={BigInt(army.entity_id)} />
      </div>
    </div>
  );
};
