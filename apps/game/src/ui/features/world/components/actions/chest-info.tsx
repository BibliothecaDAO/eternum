import { memo } from "react";

import { InfoLabel } from "./info-label";

export const ChestInfo = memo(() => {
  return (
    <InfoLabel variant="chest" className="mt-1 items-center gap-2 text-left normal-case">
      <span className="text-2xl leading-none">📦</span>
      <div className="flex flex-col gap-1 text-xs font-medium">
        <span className="text-xxs uppercase tracking-wide opacity-80">Relic Crate</span>
        <span>Contains valuable relics that can enhance your structures and armies.</span>
        <span className="text-xxs uppercase tracking-wide">Right-click to open it with this army.</span>
      </div>
    </InfoLabel>
  );
});
