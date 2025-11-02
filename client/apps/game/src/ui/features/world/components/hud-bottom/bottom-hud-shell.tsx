import { ReactNode } from "react";

interface BottomHudShellProps {
  children: ReactNode;
  className?: string;
}

// Provides the shared backdrop and spacing for the bottom HUD banner
export const BottomHudShell = ({ children, className }: BottomHudShellProps) => {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1100] flex px-0 pb-3">
      <div
        className={`pointer-events-auto flex w-full max-h-[25vh] flex-col gap-2 rounded-3xl backdrop-blur-sm overflow-hidden ${
          className ?? ""
        }`}
      >
        {children}
      </div>
    </div>
  );
};
