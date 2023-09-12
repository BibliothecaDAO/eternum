import React, { useState } from "react";
import { Road } from "./Road";
import Button from "../../../../../elements/Button";
import { RoadBuildPopup } from "./RoadBuildPopup";

type RoadsPanelProps = {} & React.HTMLAttributes<HTMLDivElement>;

export const RoadsPanel = (props: RoadsPanelProps) => {
  const [buildRoadToRealmId, setBuildRoadToRealmId] = useState<number | undefined>(undefined);

  return (
    <>
      {buildRoadToRealmId && (
        <RoadBuildPopup onClose={() => setBuildRoadToRealmId(undefined)} toRealmId={buildRoadToRealmId} />
      )}
      <div className="flex flex-col p-2 space-y-2 relative">
        <Road toRealmId={5} usage={1} onAddUsage={() => setBuildRoadToRealmId(5)} />
        <Road toRealmId={6} usage={5} onAddUsage={() => setBuildRoadToRealmId(6)} />
        <Road toRealmId={7} usage={3} onAddUsage={() => setBuildRoadToRealmId(7)} />
        <Road toRealmId={8} usage={11} onAddUsage={() => setBuildRoadToRealmId(8)} />
      </div>
    </>
  );
};
