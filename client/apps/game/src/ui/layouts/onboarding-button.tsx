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
      className={`!text-sm w-32 h-8 lg:h-10 xl:h-10 2xl:h-12 border border-gold hover:border-gold/50 hover:scale-105 hover:-translate-y-1 font-normal !normal-case ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </Button>
  );
};
