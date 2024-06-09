import { useModal } from "@/hooks/store/useModal";
import Button from "../elements/Button";
import { X } from "lucide-react";

interface ModalContainerProps {
  children: React.ReactNode;
  size?: "full" | "half";
}

export const ModalContainer = ({ children, size = "full" }: ModalContainerProps) => {
  const { toggleModal } = useModal();

  const containerClasses =
    size === "full"
      ? "w-full h-full bg-battle-one bg-cover "
      : "w-1/2 h-1/2 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2";

  return (
    <div className={` bg-brown text-gold ${containerClasses} fixed`}>
      <div className="flex justify-end absolute right-3 top-3">
        <Button size="xs" variant="default" onClick={() => toggleModal(null)}>
          <X className="w-4 h-4" />
        </Button>
      </div>
      {children}
    </div>
  );
};
