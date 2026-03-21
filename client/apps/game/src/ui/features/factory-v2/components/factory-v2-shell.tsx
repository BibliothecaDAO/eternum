import type { ReactNode } from "react";

export const FactoryV2Shell = ({ children }: { children: ReactNode }) => {
  return (
    <div className="relative h-screen overflow-y-auto bg-[#15110f] text-[#fbf4ea]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.06),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(245,158,11,0.08),_transparent_28%),linear-gradient(180deg,_rgba(21,17,15,0.98)_0%,_rgba(11,9,8,1)_100%)]" />
      <div className="pointer-events-none absolute left-[-6rem] top-16 h-72 w-72 rounded-full bg-white/5 blur-3xl" />
      <div className="pointer-events-none absolute bottom-8 right-[-5rem] h-80 w-80 rounded-full bg-amber-500/10 blur-3xl" />

      <main className="relative mx-auto flex min-h-screen max-w-[1600px] flex-col gap-4 px-0 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-0 md:gap-6 md:px-6 md:pb-32 md:pt-6 xl:px-8">
        {children}
      </main>
    </div>
  );
};
