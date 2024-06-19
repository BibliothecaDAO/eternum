// @ts-ignore
import { ArmyInfo, useArmies } from "@/hooks/helpers/useArmies";
import { EternumGlobalConfig } from "@bibliothecadao/eternum";
import { Army } from "./Army";

export const Armies = ({}: {}) => {
  const { getArmies } = useArmies();
  const armies = getArmies();

  // not show armies that are in a battle
  const filterArmiesNotInBattle = (armies: ArmyInfo[]): ArmyInfo[] => {
    return armies.filter((army: any) => {
      return army.battle_id === 0n;
    });
  };

  return filterArmiesNotInBattle(armies)
    .filter((army) => BigInt(army.current) / EternumGlobalConfig.troop.healthPrecision > 0)
    .map((army: any) => <Army key={army.entity_id} army={army} />);
};
