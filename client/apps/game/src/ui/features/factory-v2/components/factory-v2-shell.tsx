import type { ReactNode } from "react";

export const FactoryV2Shell = ({ children }: { children: ReactNode }) => {
  return (
    <div className="relative h-screen overflow-y-auto text-gold/90">
      <main className="relative mx-auto flex min-h-screen max-w-[1600px] flex-col gap-4 px-0 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-0 md:gap-6 md:px-6 md:pb-32 md:pt-6 xl:px-8">
        {children}
      </main>
    </div>
  );
};
