import { useUIStore } from "@/hooks/store/use-ui-store";
import { UnifiedArmyCreationModal } from "./unified-army-creation-modal";

export const ArmyCreationPopupManager = () => {
  const popupConfig = useUIStore((state) => state.armyCreationPopup);
  const closeArmyCreationPopup = useUIStore((state) => state.closeArmyCreationPopup);

  if (!popupConfig) {
    return null;
  }

  const { openId, ...modalProps } = popupConfig;

  return <UnifiedArmyCreationModal key={openId} {...modalProps} onClose={closeArmyCreationPopup} />;
};
