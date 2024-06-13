import useUIStore from "@/hooks/store/useUIStore";
import Button from "@/ui/elements/Button";
import { DojoHtml } from "@/ui/elements/DojoHtml";
import { View } from "@/ui/modules/navigation/LeftNavigationModule";

interface BattleLabelProps {
  visible?: boolean;
}

export const BattleLabel = ({ visible = true }: BattleLabelProps) => {
  const setBattleView = useUIStore((state) => state.setBattleView);

  // todo: implement this
  const onClick = () => {};
  //   setBattleView({
  // ownArmy: ownArmySelected,
  // opponentEntity: { type: CombatTarget.Structure, entity: target as unknown as FullStructure },
  //   });

  return (
    <DojoHtml visible={visible} className="relative -left-[15px] -top-[70px]">
      <Button
        variant="primary"
        onClick={() => {
          onClick;
        }}
      >
        View
      </Button>
    </DojoHtml>
  );
};
