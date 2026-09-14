import type { ReactNode } from "react";

/** Compact selectors sit above the editor; desktop keeps the structure browser beside it. */
export const StructureWorkspace = ({ sidebar, children }: { sidebar: ReactNode; children: ReactNode }) => (
  <div className="grid h-full min-h-0 min-w-0 grid-cols-1 grid-rows-[auto_minmax(0,1fr)] lg:grid-cols-[minmax(200px,1fr)_3fr] lg:grid-rows-1">
    <div className="min-h-0 min-w-0 border-b border-gold/15 lg:border-b-0 lg:border-r">{sidebar}</div>
    <div className="flex min-h-0 min-w-0 flex-col overflow-hidden">{children}</div>
  </div>
);
