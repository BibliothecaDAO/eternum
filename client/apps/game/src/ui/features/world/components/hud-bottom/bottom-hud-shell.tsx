import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HTMLAttributes, ReactNode } from "react";

interface BottomHudShellProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
}

// Provides the shared backdrop and spacing for the bottom HUD banner
export const BottomHudShell = ({ children, className, ...rest }: BottomHudShellProps) => {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 flex px-0" {...rest}>
      <div className={cn("pointer-events-auto flex w-full flex-col gap-2 rounded-3xl overflow-hidden", className)}>
        {children}
      </div>
    </div>
  );
};
