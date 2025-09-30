import { memo } from "react";

import { InfoLabel } from "./info-label";

export const HelpInfo = memo(() => {
  return (
    <InfoLabel variant="ally" className="mt-1 items-center justify-between gap-2">
      <span className="text-base leading-none">🛡️</span>
      <span className="text-xs font-semibold">Transfer troops/resources</span>
    </InfoLabel>
  );
});
