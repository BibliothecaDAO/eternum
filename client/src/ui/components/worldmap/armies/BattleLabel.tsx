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
    if (attackers.length === 0 || defenders.length === 0) return null;
    const target = Boolean(formattedRealmAtPosition) ? formattedRealmAtPosition : formattedStructureAtPosition;
    if (target) {
      setSelectedBattle(undefined);
      setBattleView({
        attackers: attackers,
        defenders: { type: CombatTarget.Structure, entities: target as Realm | Structure },
      });
    } else {
      setSelectedBattle(undefined);
      setBattleView({
        attackers: attackers,
        defenders: { type: CombatTarget.Army, entities: defenders },
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
