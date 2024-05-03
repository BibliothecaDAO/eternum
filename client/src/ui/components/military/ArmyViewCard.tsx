import { ClientComponents } from "@/dojo/createClientComponents";
import { useDojo } from "@/hooks/context/DojoContext";

export const ArmyViewCard = ({ army }: { army: ClientComponents["Army"]["schema"] & { name: string } }) => {
  const {
    account: { account },
    network: { provider },
    setup: {
      systemCalls: { create_army, army_buy_troops },
    },
  } = useDojo();

  return (
    <div className="border p-3">
      <h5>{army.name}</h5>
      <div>{army.battle_id ? army.battle_id : "No battle"}</div>
      <div>Battle:{army.battle_side ? army.battle_side : "idle"}</div>
      <div>Crossbowman: {army.troops.crossbowman_count}</div>
      <div>Knightcount: {army.troops.knight_count}</div>
      <div>Paladincount: {army.troops.paladin_count}</div>
    </div>
  );
};
