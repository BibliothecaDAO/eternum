import { memo } from "react";

import { InfoLabel } from "./info-label";

/** The whole crate hint: what it is and the one gesture that opens it. */
export const ChestInfo = memo(() => (
  <InfoLabel variant="chest" className="mt-1 items-center gap-2 normal-case">
    <span className="text-base leading-none">📦</span>
    <span className="text-xs font-medium">Relic Crate · right-click to open with this army</span>
  </InfoLabel>
));
ChestInfo.displayName = "ChestInfo";
