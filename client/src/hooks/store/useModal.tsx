import useUIStore from "./useUIStore";

export const useModal = () => {
  const showModal = useUIStore((state) => state.showModal);
  const modalContent = useUIStore((state) => state.modalContent);
  const toggleModal = useUIStore((state) => state.toggleModal);

  return { showModal, modalContent, toggleModal };
};
