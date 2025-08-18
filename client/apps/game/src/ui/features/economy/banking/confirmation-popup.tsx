import Button from "@/ui/design-system/atoms/button";
import { BasePopup } from "@/ui/design-system/molecules/base-popup";
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
    <BasePopup title={title} onClose={onCancel} footer={footer} contentClassName="">
      {children}
    </BasePopup>
  );
};
