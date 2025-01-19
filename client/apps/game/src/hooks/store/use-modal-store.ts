import { useUIStore } from "@/hooks/store/use-ui-store";

export const useModalStore = () => {
  const showModal = useUIStore((state) => state.showModal);
  const modalContent = useUIStore((state) => state.modalContent);
  const toggleModal = useUIStore((state) => state.toggleModal);

  return { showModal, modalContent, toggleModal };
};
