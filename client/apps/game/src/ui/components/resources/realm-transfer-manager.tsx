import { useUIStore } from "@/hooks/store/use-ui-store";
import { resources } from "@bibliothecadao/eternum";
import { memo } from "react";
import { OSWindow } from "../navigation/os-window";
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
      className={`z-[${zIndex}]`}
    >
      <RealmTransfer resource={resource} />
    </OSWindow>
  );
};
