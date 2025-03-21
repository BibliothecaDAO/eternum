import { useUIStore } from "@/hooks/store/use-ui-store";
import CircleButton from "@/ui/elements/circle-button";
import { HintModal } from "../components/hints/hint-modal";
import { BuildingThumbs } from "../config";

type HintModalButtonProps = {
  section?: string;
  className?: string;
};

export const HintModalButton = ({ className, section }: HintModalButtonProps) => {
  const toggleModal = useUIStore((state) => state.toggleModal);

  return (
    <CircleButton
      className={className}
      onClick={() => toggleModal(<HintModal initialActiveSection={section} />)}
      size={"xs"}
      image={BuildingThumbs.question}
    />
  );
};
