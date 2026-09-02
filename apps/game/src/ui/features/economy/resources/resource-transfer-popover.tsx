import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { Popover } from "@/ui/design-system/molecules/popover";
import { type ResourcesIds, resources } from "@bibliothecadao/types";
import { type ReactNode, useCallback, useId } from "react";
import { RealmTransfer } from "./realm-transfer";

interface ResourceTransferPopoverProps {
  resourceId: ResourcesIds;
  /** Runs before the popover opens, e.g. to select the structure the transfer acts on. */
  onBeforeOpen?: () => void;
  trigger: (controls: { toggle: () => void; isOpen: boolean }) => ReactNode;
}

/** A resource's transfer form, hanging off whichever chip or cell opened it — one popover instance per trigger. */
export const ResourceTransferPopover = ({ resourceId, onBeforeOpen, trigger }: ResourceTransferPopoverProps) => {
  const instanceId = useId();
  const popoverId = `transfer:${resourceId}:${instanceId}`;
  const isOpen = usePopoverStore((state) => state.openId === popoverId);
  const togglePopover = usePopoverStore((state) => state.toggle);
  const toggle = useCallback(() => {
    if (!isOpen) onBeforeOpen?.();
    togglePopover(popoverId);
  }, [isOpen, onBeforeOpen, popoverId, togglePopover]);
  const title = resources.find((resource) => resource.id === resourceId)?.trait ?? "resource";

  return (
    <Popover
      id={popoverId}
      ariaLabel={`Transfer ${title}`}
      className="w-[600px] overflow-y-auto p-0"
      trigger={trigger({ toggle, isOpen })}
    >
      <RealmTransfer resource={resourceId} />
    </Popover>
  );
};
