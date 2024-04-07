import useUIStore from "@/hooks/store/useUIStore";
import { OSWindow } from "@/components/navigation/OSWindow";
import { banks } from "@/components/navigation/Config";

import { ResourceSwap } from "@/components/bank/Swap";
import { EntityResourceTable } from "@/components/resources/EntityResourceTable";

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
