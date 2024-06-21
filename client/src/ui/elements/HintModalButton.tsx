import { useModal } from "@/hooks/store/useModal";
import CircleButton from "./CircleButton";
import { HintModal } from "../components/hints/HintModal";
import { BuildingThumbs } from "../modules/navigation/LeftNavigationModule";

type HintModalButtonProps = {
  sectionName?: string;
  className?: string;
};

export const HintModalButton = ({ className, sectionName }: HintModalButtonProps) => {
  const { toggleModal } = useModal();

  return (
    <CircleButton
      className={className}
      onClick={() => toggleModal(<HintModal initialActiveSection={sectionName} />)}
      size={"sm"}
      image={BuildingThumbs.question}
    />
  );
};
