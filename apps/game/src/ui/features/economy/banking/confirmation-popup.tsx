import Button from "@/ui/design-system/atoms/button";
import { PopoverPanel, SurfaceFrame } from "@/ui/design-system/molecules/popover";
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
  const footer = (
    <>
      <div className="flex justify-center space-x-4">
        <Button disabled={disabled} isLoading={isLoading} variant="gold" className={""} onClick={onConfirm}>
          Confirm
        </Button>
      </div>
      {disabled && <div className="px-3 mt-2 mb-1 text-danger font-bold text-center">{warning}</div>}
    </>
  );

  return (
    <PopoverPanel id="confirm" ariaLabel={title} anchor="top-center" className="w-auto p-0" onDismiss={onCancel}>
      <SurfaceFrame
        title={title}
        onClose={onCancel}
        footer={footer}
        className="w-[480px]"
        bodyClassName="p-4 text-center"
      >
        {children}
      </SurfaceFrame>
    </PopoverPanel>
  );
};
