import { useDojo } from "@/hooks/context/DojoContext";
import { ArmyInfo, getArmiesByBattleId } from "@/hooks/helpers/useArmies";
import { Realm, Structure, useStructuresPosition } from "@/hooks/helpers/useStructures";
import useUIStore from "@/hooks/store/useUIStore";
import { CombatTarget } from "@/types";
import Button from "@/ui/elements/Button";
import { DojoHtml } from "@/ui/elements/DojoHtml";
import { useMemo } from "react";

interface BattleLabelProps {
  selectedBattle: bigint;
  visible?: boolean;
}

export const BattleLabel = ({ selectedBattle, visible = true }: BattleLabelProps) => {
  const {
    account: { account },
    setup: {
      systemCalls: { battle_leave },
    },
  } = useDojo();
  const setBattleView = useUIStore((state) => state.setBattleView);
  const setSelectedBattle = useUIStore((state) => state.setSelectedBattle);

  const armies = getArmiesByBattleId(selectedBattle);
  const { formattedRealmAtPosition, formattedStructureAtPosition } = useStructuresPosition({
    position: { x: Number(armies[0]?.x) || 0, y: Number(armies[0]?.y) || 0 },
  });

  const [attackers, defenders] = useMemo(() => {
    const attackers = armies.filter((army) => army?.battle_side.toString() === "Attack") as ArmyInfo[];
    const defenders = armies.filter((army) => army?.battle_side.toString() === "Defence") as ArmyInfo[];
    return [attackers, defenders];
  }, [armies]);

  const onClick = () => {
    if (attackers.length === 0 || defenders.length === 0) {
      handleOneEmptySide(attackers, defenders, battle_leave, account, selectedBattle);
      return;
    }

    const target = Boolean(formattedRealmAtPosition) ? formattedRealmAtPosition : formattedStructureAtPosition;
    if (target) {
      setSelectedBattle(undefined);
      setBattleView({
        attackers: attackers.map((army) => BigInt(army.entity_id)),
        defenders: { type: CombatTarget.Structure, entities: target as Realm | Structure },
      });
    } else {
      setSelectedBattle(undefined);
      setBattleView({
        attackers: attackers.map((army) => BigInt(army.entity_id)),
        defenders: { type: CombatTarget.Army, entities: defenders.map((army) => BigInt(army.entity_id)) },
      });
    }
  };

  return (
    <DojoHtml visible={visible} className="relative -left-[15px] -top-[70px]">
      <Button variant="primary" onClick={onClick}>
        View
      </Button>
    </DojoHtml>
  );
};

const handleOneEmptySide = (
  attackers: ArmyInfo[],
  defenders: ArmyInfo[],
  battle_leave: any,
  account: any,
  battleId: bigint,
) => {
  let ownArmy: ArmyInfo | undefined;
  if (attackers.length === 0) {
    ownArmy = defenders.find((army) => army.isMine);
  }
  if (defenders.length === 0) {
    ownArmy = attackers.find((army) => army.isMine);
  }
  if (!ownArmy) return;
  battle_leave({ signer: account, battle_id: battleId, army_id: ownArmy.entity_id });
};
