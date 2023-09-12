import React from "react";
import { Road } from "./Road";
import Button from "../../../../../elements/Button";

type RoadsPanelProps = {} & React.HTMLAttributes<HTMLDivElement>;

export const RoadsPanel = (props: RoadsPanelProps) => {
  return (
    <div className="flex flex-col p-2 space-y-2 relative">
      <Road toRealmId={5} usage={1} />
      <Road toRealmId={6} usage={5} />
      <Road toRealmId={7} usage={3} />
      <Road toRealmId={8} usage={11} />
      <Button
        className="sticky w-32 -translate-x-1/2 bottom-2 left-1/2 !rounded-full"
        onClick={() => {}}
        variant="primary"
      >
        + Build new road
      </Button>
    </div>
  );
};
