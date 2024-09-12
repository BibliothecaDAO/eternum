import { useModalStore } from "@/hooks/store/useModalStore";
import useUIStore from "@/hooks/store/useUIStore";
import { HintModal } from "@/ui/components/hints/HintModal";
import { settings } from "@/ui/components/navigation/Config";
import { BuildingThumbs } from "@/ui/config";
import CircleButton from "@/ui/elements/CircleButton";
import { SettingsWindow } from "../settings/Settings";

export const TopLeftNavigation = () => {
  const { toggleModal } = useModalStore();

  const isPopupOpen = useUIStore((state) => state.isPopupOpen);
  const togglePopup = useUIStore((state) => state.togglePopup);
  return (
    <div className="flex gap-3 pt-6 pl-3">
      {" "}
      <div className="self-center px-3 flex space-x-2">
        <CircleButton
          image={BuildingThumbs.question}
          label={"Hints"}
          // active={isPopupOpen(quests)}
          size="md"
          onClick={() => toggleModal(<HintModal />)}
        />
        <CircleButton
          tooltipLocation="bottom"
          active={isPopupOpen(settings)}
          image={BuildingThumbs.settings}
          label={"Settings"}
          size="md"
          onClick={() => togglePopup(settings)}
        />
      </div>
      <SettingsWindow />
    </div>
  );
};
