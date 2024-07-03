import { useModal } from "@/hooks/store/useModal";
import CircleButton from "./CircleButton";
import { HintModal } from "../components/hints/HintModal";
import { BuildingThumbs } from "../modules/navigation/LeftNavigationModule";

type HintModalButtonProps = {
  section?: string;
  className?: string;
};

export const HintModalButton = ({ className, section }: HintModalButtonProps) => {
  const { toggleModal } = useModal();

  return (
    <CircleButton
      className={className}
      onClick={() => toggleModal(<HintModal initialActiveSection={section} />)}
      size={"sm"}
      image={BuildingThumbs.question}
    />
  );
};
