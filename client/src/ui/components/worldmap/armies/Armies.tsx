// @ts-ignore
import { useArmies } from "@/hooks/helpers/useArmies";
import { Army } from "./Army";

export const Armies = ({}: {}) => {
  const { getArmies } = useArmies();
  const armies = getArmies();

  // not show armies that are in a battle
  const filterArmiesNotInBattle = (armies: any) => {
    return armies.filter((army: any) => {
      return army.battle_id === 0n;
    });
  };

  return filterArmiesNotInBattle(armies).map((army: any) => <Army key={army.entity_id} army={army} />);
};
