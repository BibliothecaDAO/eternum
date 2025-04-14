import Button from "@/ui/elements/button";
import { X } from "lucide-react";
import React from "react";

interface ConfirmationPopupProps {
  title: string;
  warning?: string;
  children?: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export const ConfirmationPopup: React.FC<ConfirmationPopupProps> = ({
  title,
  warning,
  children,
  onConfirm,
  onCancel,
  isLoading = false,
  disabled,
}) => {
  return (
    <div className="fixed bottom-100 inset-0 bg-brown bg-opacity-60 z-50 flex justify-center items-center">
      <div className="border border-gold/10 bg-brown/90 bg-hex-bg rounded p-8 w-full max-w-md mx-auto flex flex-col items-center relative">
        <div className="absolute top-3 right-3">
          <Button className="amm-swap-confirm-close-selector !p-4" size="xs" variant="default" onClick={onCancel}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="text-2xl text-center w-full">{title}</div>
        {children && <div className="text-center mt-4 w-full">{children}</div>}
        <div className="flex justify-center mt-4 w-full">
          <div className="flex justify-center space-x-4">
            <Button disabled={disabled} isLoading={isLoading} variant="primary" className={""} onClick={onConfirm}>
              Confirm
            </Button>
          </div>
        </div>
        {disabled && <div className="px-3 mt-2 mb-1 text-danger font-bold text-center">{warning}</div>}
      </div>
    </div>
  );
};
