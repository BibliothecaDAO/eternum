import { useDojo } from "@/hooks/context/DojoContext";
import useUIStore from "@/hooks/store/useUIStore";
import Button from "@/ui/elements/Button";
import { DojoHtml } from "@/ui/elements/DojoHtml";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";

interface BattleLabelProps {
  selectedBattle: bigint;
  visible?: boolean;
}

export const BattleLabel = ({ selectedBattle, visible = true }: BattleLabelProps) => {
  const {
    setup: {
      components: { Position },
    },
  } = useDojo();

  const setBattleView = useUIStore((state) => state.setBattleView);
  const setSelectedBattle = useUIStore((state) => state.setSelectedBattle);

  const onClick = () => {
    const position = getComponentValue(Position, getEntityIdFromKeys([selectedBattle]));
    setSelectedBattle(undefined);
    setBattleView({
      battle: { x: Number(position!.x), y: Number(position!.y) },
      target: undefined,
    });
  };

  return (
    <DojoHtml visible={visible} className="relative -left-[15px] -top-[70px]">
      <Button variant="primary" onClick={onClick}>
        View
      </Button>
    </DojoHtml>
  );
};
