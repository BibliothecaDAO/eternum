// @ts-ignore
import { ArmyInfo, useMovableArmies } from "@/hooks/helpers/useArmies";
import { Army } from "./Army";

const filterArmies = (army: ArmyInfo) => {
  return army.health.current > 0;
};

export const Armies = ({}: {}) => {
  const { getArmies } = useMovableArmies();
  const armies = getArmies();
  return armies.filter(filterArmies).map((army: ArmyInfo) => <Army key={army.entity_id} army={army} />);
};
