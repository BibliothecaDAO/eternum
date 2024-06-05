import { useDojo } from "@/hooks/context/DojoContext";
import useUIStore from "@/hooks/store/useUIStore";
import Button from "@/ui/elements/Button";
import { DojoHtml } from "@/ui/elements/DojoHtml";
import { getComponentValue, Has, runQuery } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useMemo } from "react";

interface ArmyInfoLabelProps {
  defenderEntityId?: bigint;
  structureEntityId?: bigint;
  attackerEntityId: bigint;
}

export const AttackOrPillageLabel = ({ defenderEntityId, attackerEntityId, structureEntityId }: ArmyInfoLabelProps) => {
  const {
    setup: {
      components: { Protector },
    },
  } = useDojo();
  const setBattleView = useUIStore((state) => state.setBattleView);

  const attackedArmyId = useMemo(() => {
    if (defenderEntityId) return defenderEntityId;
    if (structureEntityId) {
      const attackedArmy = getComponentValue(Protector, getEntityIdFromKeys([BigInt(structureEntityId)]));
      return attackedArmy?.army_id;
    }
  }, [structureEntityId, defenderEntityId, attackerEntityId]);

  console.log(attackedArmyId);

  const attack = async () => {
    // if (!attackedArmyId) {
    //   return;
    // }

    setBattleView({
      attackerId: attackerEntityId,
      defenderId: BigInt(attackedArmyId || 0n),
      structure: BigInt(structureEntityId || 0n),
    });
  };

  return (
    <DojoHtml className="relative -left-[15px] -top-[70px]">
      <Button variant="primary" onClick={attack}>
        Attack
      </Button>
    </DojoHtml>
  );
};
