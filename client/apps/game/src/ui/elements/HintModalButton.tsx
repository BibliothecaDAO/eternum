import { useModalStore } from "@/hooks/store/use-modal-store";
import { HintModal } from "../components/hints/HintModal";
import { BuildingThumbs } from "../config";
import CircleButton from "./CircleButton";

type HintModalButtonProps = {
  section?: string;
  className?: string;
};

export const HintModalButton = ({ className, section }: HintModalButtonProps) => {
  const { toggleModal } = useModalStore();

  return (
    <CircleButton
      className={className}
      onClick={() => toggleModal(<HintModal initialActiveSection={section} />)}
      size={"xs"}
      image={BuildingThumbs.question}
    />
  );
};
