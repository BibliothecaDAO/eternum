import type { ReactNode } from "react";

/** One of Settings' sections: its name over its rows. */
export const SettingsSection = ({ title, children }: { title: string; children: ReactNode }) => (
  <section aria-label={title} className="flex flex-col">
    <h2 className="text-hud-label text-hud-muted">{title}</h2>
    {children}
  </section>
);
