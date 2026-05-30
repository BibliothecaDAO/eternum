import { useUIStore } from "@/hooks/store/use-ui-store";
import { LoadingAnimation } from "@/ui/design-system/molecules/loading-animation";
import { CenteredModalShell } from "@/ui/features/world/containers/centered-modal-shell";
import { ActorType, ID } from "@bibliothecadao/types";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import { Suspense, useCallback } from "react";
import { ChestContainer } from "./chest-container";

export const ChestModal = ({
  selected,
  chestHex,
}: {
  selected: {
    type: ActorType;
    id: ID;
    hex: { x: number; y: number };
  };
  chestHex: { x: number; y: number };
}) => {
  const toggleModal = useUIStore((state) => state.toggleModal);
  const close = useCallback(() => toggleModal(null), [toggleModal]);

  return (
    <CenteredModalShell
      title="Open Relic Crate"
      icon={Sparkles}
      onClose={close}
      size="xl"
      bodyClassName="overflow-y-auto overflow-x-hidden"
    >
      <Suspense fallback={<LoadingAnimation />}>
        <ChestContainer explorerEntityId={selected.id} chestHex={chestHex} />
      </Suspense>
    </CenteredModalShell>
  );
};
