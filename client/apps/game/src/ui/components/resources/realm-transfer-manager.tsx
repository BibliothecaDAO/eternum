import { useUIStore } from "@/hooks/store/use-ui-store";
import { resources } from "@bibliothecadao/eternum";
import { OSWindow } from "../navigation/os-window";
import { RealmTransfer } from "./realm-transfer";

export const RealmTransferManager = ({ zIndex = 100 }: { zIndex?: number }) => {
  return resources.map((resource) => (
    <RealmTransferContainer key={resource.id} resource={resource.id} zIndex={zIndex} />
  ));
};

const RealmTransferContainer = ({ resource, zIndex }: { resource: number; zIndex: number }) => {
  const isOpen = useUIStore((state) => state.isPopupOpen(resource.toString()));

  const togglePopup = useUIStore.getState().togglePopup(resource.toString());

  return (
    <OSWindow
      title={resources.find((r) => r.id === resource)?.trait ?? ""}
      onClick={() => togglePopup}
      show={isOpen}
      className={`z-[${zIndex}]`}
    >
      <RealmTransfer resource={resource} />
    </OSWindow>
  );
};
