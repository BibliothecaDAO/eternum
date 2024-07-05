import Button from "@/ui/elements/Button";
import React from "react";

interface ConfirmationPopupProps {
  title: string;
  children?: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmationPopup: React.FC<ConfirmationPopupProps> = ({ title, children, onConfirm, onCancel }) => {
  return (
    <div className="fixed bottom-100 inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
      <div className="bg-gold/10 rounded-lg p-8 w-full max-w-md mx-auto flex flex-col items-center">
        <div className="text-2xl text-center w-full">{title}</div>
        {children && <div className="text-center mt-4 w-full">{children}</div>}
        <div className="flex justify-center mt-4 w-full">
          <div className="flex justify-center space-x-4">
            <Button className={""} onClick={onConfirm}>
              Confirm
            </Button>
            <Button onClick={onCancel} variant="secondary">
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
