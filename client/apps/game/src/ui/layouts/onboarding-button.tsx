import Button from "@/ui/elements/button";
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
      size="lg"
      variant="outline"
      className={`!text-sm w-32 h-8 lg:h-10 xl:h-10 2xl:h-12 ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </Button>
  );
};
