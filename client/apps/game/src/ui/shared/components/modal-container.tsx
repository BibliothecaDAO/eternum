import { useUIStore } from "@/hooks/store/use-ui-store";
import Button from "@/ui/design-system/atoms/button";
import { X } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";

interface ModalContainerProps {
  children: React.ReactNode;
  size?: "full" | "half" | "small" | "medium" | "large" | "auto";
  title?: string;
}

export const ModalContainer = ({ children, size = "full", title }: ModalContainerProps) => {
  const toggleModal = useUIStore((state) => state.toggleModal);
  const modalRef = useRef<HTMLDivElement>(null);

  const containerClasses = (() => {
    switch (size) {
      case "full":
        return "w-full h-full";
      case "half":
        return "w-1/2 h-1/2";
      case "small":
        return "w-1/3 h-1/3";
      case "medium":
        return "w-2/3 h-2/3";
      case "large":
        return "w-4/5 h-4/5";
      case "auto":
        return "max-w-[90%] max-h-[90%] inline-block";
      default:
        return "w-full h-full pb-20";
    }
  })();

  const handleEscapePress = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        toggleModal(null);
      }
    },
    [toggleModal],
  );

  const handleBackdropPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) {
        toggleModal(null);
      }
    },
    [toggleModal],
  );

  useEffect(() => {
    // Focus the modal when it mounts
    if (modalRef.current) {
      modalRef.current.focus();
    }
  }, []);

  useEffect(() => {
    // Add event listener to the modal itself
    const modalElement = modalRef.current;
    if (modalElement) {
      modalElement.addEventListener("keydown", handleEscapePress);
    }
    return () => modalElement?.removeEventListener("keydown", handleEscapePress);
  }, [handleEscapePress]);

  return (
    <div
      className="z-50 flex h-full w-full items-center justify-center"
      onPointerDown={handleBackdropPointerDown}
    >
      <div
        ref={modalRef}
        className={`bg-dark-wood panel-wood text-gold ${containerClasses} overflow-hidden`}
        tabIndex={0}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className={`flex flex-col ${size === "auto" ? "h-auto" : "h-full"}`}>
          <div className="flex justify-between items-center p-2 border-b border-gold/30">
            <h5>{title}</h5>
            <div className="flex justify-end p-1">
              <Button className="!p-4" size="xs" variant="danger" onClick={() => toggleModal(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className={`${size === "auto" ? "" : "flex-1"} overflow-auto px-2`}>{children}</div>
        </div>
      </div>
    </div>
  );
};
