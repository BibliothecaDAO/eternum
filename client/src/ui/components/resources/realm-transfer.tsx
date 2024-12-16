import useUIStore from "@/hooks/store/useUIStore";
import { ResourcesIds, findResourceById } from "@bibliothecadao/eternum";
import { OSWindow } from "../navigation/OSWindow";

export const RealmTransfer = ({
  resource,
  balance,
  icon,
}: {
  resource: ResourcesIds;
  balance: number;
  icon: React.ReactNode;
}) => {
  const togglePopup = useUIStore((state) => state.togglePopup);
  const isOpen = useUIStore((state) => state.isPopupOpen(resource.toString()));

  return (
    <OSWindow
      title={findResourceById(resource)?.trait ?? ""}
      onClick={() => togglePopup(resource.toString())}
      show={isOpen}
    >
      <div>
        {icon}
        {resource}
      </div>
      <div>{balance}</div>
    </OSWindow>
  );
};
