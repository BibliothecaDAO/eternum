import useUIStore from "@/hooks/store/useUIStore";
import Button from "@/ui/elements/Button";
import { DojoHtml } from "@/ui/elements/DojoHtml";
import { View } from "@/ui/modules/navigation/LeftNavigationModule";

interface ArmyInfoLabelProps {
  visible?: boolean;
  structureIsMine: boolean | undefined;
}

export const CombatLabel = ({ visible = true, structureIsMine }: ArmyInfoLabelProps) => {
  const setView = useUIStore((state) => state.setLeftNavigationView);

  return (
    <DojoHtml visible={visible} className="relative -left-[15px] -top-[70px]">
      <Button
        variant="primary"
        onClick={() => {
          setView(View.EntityView);
        }}
      >
        {structureIsMine ? "Defend" : "Combat"}
      </Button>
    </DojoHtml>
  );
};
