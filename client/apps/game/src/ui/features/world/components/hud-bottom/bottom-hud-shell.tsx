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
        className={`pointer-events-auto flex w-full max-h-[25vh] flex-col gap-2 rounded-3xl border border-white/5 bg-black/15 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.22)] backdrop-blur-sm overflow-hidden ${
          className ?? ""
        }`}
      >
        {children}
      </div>
    </div>
  );
};
