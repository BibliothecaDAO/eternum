import type { ReactNode } from "react";

/** A band of a desktop page that scrolls: its title in the display face (a link or a note at its end), then its content. */
export const Band = ({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) => (
  <section className="flex flex-col gap-5">
    <header className="flex items-end justify-between">
      <h2 className="font-display text-[34px] leading-none text-kit-cream">{title}</h2>
      {aside}
    </header>
    {children}
  </section>
);
