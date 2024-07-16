// @ts-ignore
import { ArmyInfo, useMovableArmies } from "@/hooks/helpers/useArmies";
import { Army } from "./Army";

export const Armies = ({}: {}) => {
  const { getArmies } = useMovableArmies();
  const armies = getArmies();

  return armies
    .filter((army) => BigInt(army.health.current) > 0)
    .map((army: ArmyInfo) => <Army key={army.entity_id} army={army} />);
};
