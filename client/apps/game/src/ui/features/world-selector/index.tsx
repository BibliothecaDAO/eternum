import { useUIStore } from "@/hooks/store/use-ui-store";
import { WorldSelectorModal, type WorldSelection } from "./world-selector-modal";

export const openWorldSelectorModal = (): Promise<WorldSelection> => {
  return new Promise((resolve, reject) => {
    const { setModal } = useUIStore.getState();
    const handleConfirm = (selection: WorldSelection) => resolve(selection);
    const handleCancel = () => reject(new Error("World selection cancelled"));
    setModal(<WorldSelectorModal onConfirm={handleConfirm} onCancel={handleCancel} />, true);
  });
};

export type { WorldSelection } from "./world-selector-modal";
