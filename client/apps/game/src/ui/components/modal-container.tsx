import { useUIStore } from "@/hooks/store/use-ui-store";
import Button from "@/ui/elements/button";
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
        return "w-full h-full pb-20";
      case "half":
        return "w-1/2 h-1/2 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2";
      case "small":
        return "w-1/3 h-1/3 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2";
      case "medium":
        return "w-2/3 h-2/3 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2";
      case "large":
        return "w-4/5 h-4/5 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2";
      case "auto":
        return "max-w-[90%] max-h-[90%] top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 inline-block";
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
      ref={modalRef}
      className={`z-50  dark:bg-dark-wood panel-wood text-gold ${containerClasses} fixed overflow-hidden focus:outline-none focus:ring-2 focus:ring-gold/50`}
      tabIndex={0}
    >
      <div className={`flex flex-col ${size === "auto" ? "h-auto" : "h-full"}`}>
        <div className="flex justify-between items-center p-2">
          <h5>{title}</h5>
          <div className="flex justify-end p-1">
            <Button className="!p-4" size="xs" variant="danger" onClick={() => toggleModal(null)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <div className={`${size === "auto" ? "" : "flex-1"} overflow-auto pl-2 pr-2 pb-2`}>{children}</div>
      </div>
    </div>
  );
};
