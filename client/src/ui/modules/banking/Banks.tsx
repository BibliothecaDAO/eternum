import useUIStore from "@/hooks/store/useUIStore";
import { OSWindow } from "@/ui/components/navigation/OSWindow";
import { banks } from "@/ui/components/navigation/Config";

import { ResourceSwap } from "@/ui/components/bank/Swap";
import { EntityResourceTable } from "@/ui/components/resources/EntityResourceTable";

export const Banks = () => {
  const { togglePopup } = useUIStore();

  const isOpen = useUIStore((state) => state.isPopupOpen(banks));

  return (
    <OSWindow onClick={() => togglePopup(banks)} show={isOpen} title={banks}>
      <div>
        <div className="p-2">
          <h3>The Bank of Loaf</h3>
        </div>

        <ResourceSwap />
        <EntityResourceTable />
      </div>
    </OSWindow>
  );
};
