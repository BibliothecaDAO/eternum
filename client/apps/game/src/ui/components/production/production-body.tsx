import { RealmInfo as RealmInfoType } from "@bibliothecadao/eternum";
import { useState } from "react";
import { BuildingsList } from "./buildings-list";
import { ProductionControls } from "./production-controls";
import { RealmInfo } from "./realm-info";

export const ProductionBody = ({ realm }: { realm: RealmInfoType }) => {
  const [selectedResource, setSelectedResource] = useState<number | null>(null);

  return (
    <div className="space-y-4">
      <RealmInfo realm={realm} />
      <BuildingsList realm={realm} onSelectProduction={setSelectedResource} selectedResource={selectedResource} />
      {selectedResource && <ProductionControls selectedResource={selectedResource} realm={realm} />}
    </div>
  );
};
