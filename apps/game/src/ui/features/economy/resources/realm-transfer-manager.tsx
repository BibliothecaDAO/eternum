import { useUIStore } from "@/hooks/store/use-ui-store";
import { CenteredModalShell } from "@/ui/features/world/containers/centered-modal-shell";
import { resources } from "@bibliothecadao/types";
import { memo } from "react";
import { RealmTransfer } from "./realm-transfer";

export const RealmTransferManager = memo(() => {
  return resources.map((resource) => <RealmTransferContainer key={resource.id} resource={resource.id} />);
});

const RealmTransferContainer = ({ resource }: { resource: number }) => {
  const isOpen = useUIStore((state) => state.isPopupOpen(resource.toString()));
  const togglePopup = useUIStore((state) => state.togglePopup);

  if (!isOpen) return null;

  const title = resources.find((r) => r.id === resource)?.trait ?? "";

  return (
    <CenteredModalShell
      title={title}
      onClose={() => togglePopup(resource.toString())}
      persistKey={title}
      panelClassName="w-[600px] h-auto max-h-[calc(100vh-64px)]"
      bodyClassName="overflow-auto"
    >
      <RealmTransfer resource={resource} />
    </CenteredModalShell>
  );
};
