import { useUIStore } from "@/hooks/store/use-ui-store";
import { WorldSelectorModal } from "./world-selector-modal";

export const openWorldSelectorModal = (): Promise<string> => {
  return new Promise((resolve, reject) => {
    const { setModal } = useUIStore.getState();
    const handleConfirm = (name: string) => resolve(name);
    const handleCancel = () => reject(new Error("World selection cancelled"));
    setModal(<WorldSelectorModal onConfirm={handleConfirm} onCancel={handleCancel} />, true);
  });
};
