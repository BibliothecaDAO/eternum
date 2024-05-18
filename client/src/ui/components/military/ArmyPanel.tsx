import { useMemo, useState } from "react";
import { Tabs } from "@/ui/elements/tab";

import { TroopSelect } from "../military/TroopSelect";
import { EntityArmyList } from "./ArmyList";

export const ArmyPanel = ({ entity }: any) => {
  return (
    <div>
      <div className="flex justify-between">
        <h3>{entity.name}</h3>
      </div>

      <EntityArmyList entity_id={entity} />
    </div>
  );
};
