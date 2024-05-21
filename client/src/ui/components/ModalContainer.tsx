import { useModal } from "@/hooks/store/useModal";
import Button from "../elements/Button";
import { X } from "lucide-react";

export const ModalContainer = ({ children }: { children: React.ReactNode }) => {
  const { toggleModal } = useModal();

  return (
    <div className="p-4 bg-brown text-gold w-full h-full bg-battle-one bg-cover">
      <div className="flex justify-end absolute right-3 top-3">
        <Button size="xs" variant="default" onClick={() => toggleModal(null)}>
          <X className="w-4 h-4" />
        </Button>
      </div>
      {children}
    </div>
  );
};
