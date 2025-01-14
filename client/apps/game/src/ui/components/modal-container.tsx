import Button from "@/ui/elements/button";
import { useModalStore } from "@bibliothecadao/react";
import { X } from "lucide-react";
import { useCallback, useEffect } from "react";

interface ModalContainerProps {
  children: React.ReactNode;
  size?: "full" | "half";
}

export const ModalContainer = ({ children, size = "full" }: ModalContainerProps) => {
  const { toggleModal } = useModalStore();

  const containerClasses =
    size === "full"
      ? "w-full h-full   p-4"
      : "w-1/2 h-1/2 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2";

  const handleEscapePress = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        toggleModal(null);
      }
    },
    [toggleModal],
  );

  useEffect(() => {
    const worldElement = document.getElementById("world");
    if (worldElement) {
      worldElement.addEventListener("keydown", handleEscapePress);
    }
    return () => worldElement?.removeEventListener("keydown", handleEscapePress);
  }, [handleEscapePress]);

  return (
    <div className={` bg-brown/90 text-gold ${containerClasses} fixed`} tabIndex={0}>
      <div className="flex justify-end absolute right-3 top-3">
        <Button className="!p-4" size="xs" variant="default" onClick={() => toggleModal(null)}>
          <X className="w-4 h-4" />
        </Button>
      </div>
      {children}
    </div>
  );
};
