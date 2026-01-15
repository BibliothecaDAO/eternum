import { useUIStore } from "@/hooks/store/use-ui-store";
import { OSWindow } from "@/ui/features/world";
import { resources } from "@bibliothecadao/types";
import { memo } from "react";
import { RealmTransfer } from "./realm-transfer";

export const RealmTransferManager = memo(({ zIndex = 100 }: { zIndex?: number }) => {
  return resources.map((resource) => (
    <RealmTransferContainer key={resource.id} resource={resource.id} zIndex={zIndex} />
  ));
});

const RealmTransferContainer = ({ resource, zIndex }: { resource: number; zIndex: number }) => {
  const isOpen = useUIStore((state) => state.isPopupOpen(resource.toString()));
  const togglePopup = useUIStore((state) => state.togglePopup);

  return (
    <OSWindow
      title={resources.find((r) => r.id === resource)?.trait ?? ""}
      onClick={() => togglePopup(resource.toString())}
      show={isOpen}
      width="600px"
      className={`z-[${zIndex}]`}
    >
      <RealmTransfer resource={resource} />
    </OSWindow>
  );
};
