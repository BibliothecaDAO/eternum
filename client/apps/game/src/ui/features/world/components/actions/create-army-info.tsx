import { memo } from "react";

import { InfoLabel } from "./info-label";

export const CreateArmyInfo = memo(() => {
  return (
    <InfoLabel variant="mine" className="mt-1 items-center gap-2 text-left normal-case">
      <span className="text-2xl leading-none">🗡️</span>
      <div className="flex flex-col gap-1 text-xs font-medium">
        <span className="text-xxs uppercase tracking-wide opacity-80">Create Army</span>
        <span>Create an army to help you explore the world.</span>
      </div>
    </InfoLabel>
  );
});
