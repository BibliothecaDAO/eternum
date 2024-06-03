import { useDojo } from "@/hooks/context/DojoContext";
import { ArmyAndName } from "@/hooks/helpers/useArmies";
import Button from "@/ui/elements/Button";
import { DojoHtml } from "@/ui/elements/DojoHtml";

interface ArmyInfoLabelProps {
  attackedInfo: ArmyAndName;
  attackerEntityId: bigint;
}

export const AttackOrPillageLabel = ({ attackedInfo, attackerEntityId }: ArmyInfoLabelProps) => {
  const {
    account: { account },
    setup: {
      systemCalls: { battle_start },
    },
  } = useDojo();
  console.log(attackerEntityId);
  const attack = async () => {
    await battle_start({
      signer: account,
      attacking_army_id: attackerEntityId,
      defending_army_id: attackedInfo.entity_id,
    });
  };

  return (
    <DojoHtml className="relative -left-[15px] -top-[70px]">
      <Button onClick={attack}>Attack</Button>
    </DojoHtml>
  );
};
