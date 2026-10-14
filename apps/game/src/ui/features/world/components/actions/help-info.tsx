import { memo } from "react";

import { InfoLabel } from "./info-label";

export const HelpInfo = memo(() => {
  return (
    <InfoLabel variant="ally" className="mt-1 items-center gap-2 text-left">
      <span className="text-2xl leading-none">🛡️</span>
      <div className="flex flex-col gap-1 text-sm font-medium">
        <span className="text-sm opacity-80">Troops / Resources</span>
      </div>
    </InfoLabel>
  );
});
