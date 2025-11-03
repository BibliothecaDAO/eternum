import { ReactNode } from "react";

interface HudPanelProps {
  title?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

// Defines consistent styling for sub-panels within the bottom HUD
export const HudPanel = ({ title, icon, actions, children, className }: HudPanelProps) => {
  return (
    <section
      className={`flex h-full min-w-0 flex-col gap-3 rounded-2xl border border-white/5 bg-black/5 p-3 shadow-[0_12px_30px_rgba(0,0,0,0.12)] overflow-hidden ${
        className ?? ""
      }`}
    >
      <div className="flex-1 min-h-0 overflow-auto">{children}</div>
    </section>
  );
};
