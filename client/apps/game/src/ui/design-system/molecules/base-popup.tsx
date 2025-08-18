import Button from "@/ui/design-system/atoms/button";
import { X } from "lucide-react";
import React, { useEffect, useRef } from "react";

interface BasePopupProps {
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onClose: () => void;
  className?: string;
  contentClassName?: string;
  width?: string;
}

export const BasePopup: React.FC<BasePopupProps> = ({
  title,
  children,
  footer,
  onClose,
  className = "",
  contentClassName = "",
  width = "max-w-md",
}) => {
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    // Add event listener
    document.addEventListener("keydown", handleEscape);

    // Focus the popup to ensure keyboard events work
    if (popupRef.current) {
      popupRef.current.focus();
    }

    // Cleanup
    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  return (
    <div className="fixed bottom-100 inset-0 bg-brown bg-opacity-60 z-50 flex justify-center items-center">
      <div
        ref={popupRef}
        tabIndex={-1}
        className={`border border-gold/10 bg-brown/90 panel-wood rounded p-8 w-full ${width} mx-auto flex flex-col items-center relative ${className}`}
      >
        <div className="absolute top-3 right-3">
          <Button className="!p-4" size="xs" variant="default" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {title && <h5 className="text-gold font-bold mb-4">{title}</h5>}

        <div className={`text-center mt-4 w-full ${contentClassName}`}>{children}</div>

        {footer && <div className="flex justify-center mt-4 w-full">{footer}</div>}
      </div>
    </div>
  );
};
