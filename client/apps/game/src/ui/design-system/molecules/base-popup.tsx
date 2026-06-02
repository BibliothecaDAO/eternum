import { cn } from "@/ui/design-system/atoms/lib/utils";
import React from "react";
import { DialogShell } from "./dialog-shell";

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
  return (
    <DialogShell
      title={title}
      onClose={onClose}
      footer={footer}
      size="auto"
      backdropClassName="bg-brown/70"
      panelClassName={cn("w-full p-4", width, className)}
      contentClassName={cn("text-center", contentClassName)}
      footerClassName="flex justify-center"
    >
      {children}
    </DialogShell>
  );
};
