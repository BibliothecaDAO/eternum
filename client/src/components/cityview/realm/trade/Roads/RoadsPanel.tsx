import React, { useState } from "react";
import { Road } from "./Road";
import { RoadBuildPopup } from "./RoadBuildPopup";
import useRealmStore from "../../../../../hooks/store/useRealmStore";
import { useGetRoads } from "../../../../../hooks/helpers/useRoads";

type RoadsPanelProps = {} & React.HTMLAttributes<HTMLDivElement>;

// @ts-ignore
export const RoadsPanel = (props: RoadsPanelProps) => {
  const [buildRoadToEntityId, setBuildRoadToEntityId] = useState<number | undefined>(undefined);

  const realmEntityId = useRealmStore((state) => state.realmEntityId);

  const { roads } = useGetRoads(realmEntityId);

  return (
    <>
      {buildRoadToEntityId && (
        <RoadBuildPopup onClose={() => setBuildRoadToEntityId(undefined)} toEntityId={buildRoadToEntityId} />
      )}
      <div className="flex flex-col p-2 space-y-2 relative">
        {roads.map((road) => (
          <Road road={road} onAddUsage={() => setBuildRoadToEntityId(road.destinationEntityId)} />
        ))}
      </div>
    </>
  );
};
