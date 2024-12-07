import Button from "@/ui/elements/Button";
import { ReactNode } from "react";

export const OnboardingButton = ({
  children,
  className,
  onClick,
  disabled,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
}) => {
  return (
    <Button
      size="md"
      variant="outline"
      className={`!text-sm w-32 border border-gold hover:border-gold/50 h-12 hover:scale-105 hover:-translate-y-1 font-normal !normal-case ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </Button>
  );
};
