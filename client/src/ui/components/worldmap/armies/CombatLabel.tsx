import useUIStore from "@/hooks/store/useUIStore";
import Button from "@/ui/elements/Button";
import { DojoHtml } from "@/ui/elements/DojoHtml";
import { View } from "@/ui/modules/navigation/LeftNavigationModule";

interface ArmyInfoLabelProps {
  visible?: boolean;
}

export const CombatLabel = ({ visible = true }: ArmyInfoLabelProps) => {
  const setView = useUIStore((state) => state.setLeftNavigationView);

  return (
    <DojoHtml visible={visible} className="relative -left-[15px] -top-[70px]">
      <Button
        variant="primary"
        onClick={() => {
          console.log("hey");
          setView(View.EntityView);
        }}
      >
        Combat
      </Button>
    </DojoHtml>
  );
};
