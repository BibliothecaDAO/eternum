import { memo } from "react";

import { InfoLabel } from "./info-label";

export const HelpInfo = memo(() => {
  return (
    <InfoLabel variant="ally" className="mt-1 items-center gap-2 text-left normal-case">
      <span className="text-2xl leading-none">🛡️</span>
      <div className="flex flex-col gap-1 text-xs font-medium">
        <span className="text-xxs uppercase tracking-wide opacity-80">Help</span>
        <span>Help an army that is attacking your structure.</span>
        <span className="text-xxs uppercase tracking-wide">Click to help the army.</span>
      </div>
    </InfoLabel>
  );
});
