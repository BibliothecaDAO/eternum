import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { BuildingThumbs } from "@/ui/config";
import CircleButton from "@/ui/design-system/molecules/circle-button";
import { HintModal } from "@/ui/features/progression";

type HintModalButtonProps = {
  section?: string;
  className?: string;
};

export const HintModalButton = ({ className, section }: HintModalButtonProps) => {
  const openSurface = usePopoverStore((state) => state.openSurface);

  return (
    <CircleButton
      className={className}
      onClick={() => openSurface({ id: "hints", content: <HintModal initialActiveSection={section} /> })}
      size={"sm"}
      image={BuildingThumbs.question}
    />
  );
};
