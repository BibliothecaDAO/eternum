import { useUIStore } from "@/hooks/store/use-ui-store";
import { resources } from "@bibliothecadao/eternum";
import { OSWindow } from "../navigation/os-window";
import { RealmTransfer } from "./realm-transfer";

export const RealmTransferManager = () => {
  return resources.map((resource) => <RealmTransferContainer key={resource.id} resource={resource.id} />);
};

const RealmTransferContainer = ({ resource }: { resource: number }) => {
  const isOpen = useUIStore((state) => state.isPopupOpen(resource.toString()));

  return (
    <OSWindow
      title={resources.find((r) => r.id === resource)?.trait ?? ""}
      onClick={() => useUIStore.getState().togglePopup(resource.toString())}
      show={isOpen}
      className="z-[100]"
    >
      <RealmTransfer resource={resource} />
    </OSWindow>
  );
};
