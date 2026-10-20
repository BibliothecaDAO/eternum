import { HudSwitch } from "@/ui/design-system/kit/hud-elements";
import React from "react";

/** Which balances the table shows: the selected realm's alone, or every realm's together. */
export const ViewToggle = React.memo(
  ({ useNewVersion, onToggle }: { useNewVersion: boolean; onToggle: (useNew: boolean) => void }) => (
    <span className="inline-flex items-center gap-2 text-hud-label">
      <span className={useNewVersion ? "text-hud-cue" : undefined}>Single Realm View</span>
      <HudSwitch on={useNewVersion} label="All Realms View" onChange={onToggle} />
      <span className={useNewVersion ? undefined : "text-hud-cue"}>All Realms View</span>
    </span>
  ),
);
