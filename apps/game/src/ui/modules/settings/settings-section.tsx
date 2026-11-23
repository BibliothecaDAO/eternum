import type { ReactNode } from "react";

/** One of Settings' sections: its name over its rows. */
export const SettingsSection = ({ title, children }: { title: string; children: ReactNode }) => (
  <section
    aria-label={title}
    className="flex flex-col gap-1 rounded-lg border border-hud-divider bg-hud-well px-3 py-2.5"
  >
    <h2 className="text-hud-label uppercase tracking-wide text-hud-muted">{title}</h2>
    {children}
  </section>
);
