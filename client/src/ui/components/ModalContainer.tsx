import { useModal } from "@/hooks/store/useModal";
import Button from "../elements/Button";

export const ModalContainer = ({ children }: { children: React.ReactNode }) => {
  const { toggleModal } = useModal();

  return (
    <div className="p-8 bg-brown text-gold w-full h-full bg-battle-one ">
      <div className="flex justify-end">
        <Button variant="primary" onClick={() => toggleModal(null)}>
          Close
        </Button>
      </div>
      {children}
    </div>
  );
};
