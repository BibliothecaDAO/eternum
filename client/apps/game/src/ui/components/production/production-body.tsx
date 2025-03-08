import { RealmInfo as RealmInfoType, ResourcesIds } from "@bibliothecadao/eternum";
import { useState } from "react";
import { BuildingsList } from "./buildings-list";
import { ProductionControls } from "./production-controls";
import { RealmInfo } from "./realm-info";

export const ProductionBody = ({
  realm,
  preSelectedResource,
}: {
  realm: RealmInfoType;
  preSelectedResource?: ResourcesIds;
}) => {
  const [selectedResource, setSelectedResource] = useState<ResourcesIds | null>(preSelectedResource || null);

  return (
    <div className="space-y-4">
      <RealmInfo realm={realm} />
      <BuildingsList realm={realm} onSelectProduction={setSelectedResource} selectedResource={selectedResource} />
      {selectedResource && <ProductionControls selectedResource={selectedResource} realm={realm} />}
    </div>
  );
};
