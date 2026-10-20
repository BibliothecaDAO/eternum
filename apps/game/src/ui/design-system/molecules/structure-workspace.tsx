import type { ReactNode } from "react";

/** Compact selectors sit above the editor; desktop keeps the structure browser beside it, a quarter of the width. */
export const StructureWorkspace = ({ sidebar, children }: { sidebar: ReactNode; children: ReactNode }) => (
  <div className="flex h-full min-h-0 min-w-0 flex-col lg:flex-row">
    <div className="min-h-0 min-w-0 border-b border-hud-divider lg:w-1/4 lg:min-w-48 lg:border-b-0 lg:border-r">
      {sidebar}
    </div>
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
  </div>
);
