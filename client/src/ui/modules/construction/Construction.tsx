import useUIStore from "@/hooks/store/useUIStore";
import { OSWindow } from "@/ui/components/navigation/OSWindow";
import { construction, trade } from "@/ui/components/navigation/Config";
import { Tabs } from "@/ui/elements/tab";
import { useMemo, useState } from "react";
import { SelectPreviewBuilding } from "@/ui/components/construction/SelectPreviewBuilding";
import { EntityPopulation } from "@/ui/components/entities/EntityPopulation";
export const Construction = ({ entityId }: { entityId: bigint | undefined }) => {
  const { togglePopup } = useUIStore();
  const [selectedTab, setSelectedTab] = useState(0);
  const isOpen = useUIStore((state) => state.isPopupOpen(construction));
  // const tabs = useMemo(
  //   () => [
  //     {
  //       key: "all",
  //       label: (
  //         <div className="flex relative group flex-col items-center">
  //           <div>Realm</div>
  //         </div>
  //       ),
  //       component: <SelectPreviewBuilding />,
  //     },
  //   ],
  //   [selectedTab],
  // );

  return (
    <OSWindow onClick={() => togglePopup(construction)} show={isOpen} title={construction}>
      <EntityPopulation entityId={entityId} />
      <SelectPreviewBuilding />
    </OSWindow>
  );
};
