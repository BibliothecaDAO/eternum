import { useStore } from "@/shared/store";
import { ProductionWidgetsSection } from "../components/production-widgets-section";

export function ProductionTab() {
  const selectedRealm = useStore((state) => state.selectedRealm);

  return (
    <div className="space-y-4">
      {selectedRealm && <ProductionWidgetsSection selectedRealm={selectedRealm} isVertical={true} />}
    </div>
  );
}
