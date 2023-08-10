import React, { useEffect, useMemo, useState } from "react";
import { FiltersPanel } from "../../../../elements/FiltersPanel";
import { FilterButton } from "../../../../elements/FilterButton";
import { SortPanel } from "../../../../elements/SortPanel";
import { SortButton, SortInterface } from "../../../../elements/SortButton";
import { LaborComponent } from "./LaborComponent";
import useRealmStore from "../../../../hooks/store/useRealmStore";
import { unpackResources } from "../../../../utils/packedData";
import { ResourcesIds } from "../../../../constants/resources";
import { LaborBuildPopup } from "./LaborBuild";
import { LaborConfig } from "../../../../types";
import {
  useGetRealm,
  useGetRealmLabor,
  useGetRealmResources,
} from "../../../../hooks/graphql/useGraphQLQueries";
import { getRealm } from "../SettleRealmComponent";

type LaborPanelProps = {};

export const LaborPanel = ({ }: LaborPanelProps) => {
  const [activeFilter, setActiveFilter] = useState(false);
  const [buildResource, setBuildResource] = useState<number | null>(null);
  const [buildLoadingStates, setBuildLoadingStates] = useState<{
    [key: number]: boolean;
  }>({});

  const sortingParams = useMemo(() => {
    return [
      { label: "Number", sortKey: "number", className: "mr-auto" },
      { label: "Balance", sortKey: "balance", className: "mr-auto" },
      { label: "Expires", sortKey: "expires", className: "mr-auto" },
      { label: "Harvested", sortKey: "harvested", className: "mr-auto" },
    ];
  }, []);

  const [activeSort, setActiveSort] = useState<SortInterface>({
    sortKey: "number",
    sort: "none",
  });

  let { realmEntityId, realmId } = useRealmStore();

  const { realmLabor } = useGetRealmLabor(realmEntityId);
  const { realmResources } = useGetRealmResources(realmEntityId);

  const realm = useMemo(() => {
    return realmId ? getRealm(realmId) : undefined;
  }, [realmId]);

  // unpack the resources
  let realmResourceIds = useMemo(() => {
    if (realm) {
      let unpackedResources = unpackResources(
        BigInt(realm.resource_types_packed),
        realm.resource_types_count,
      );
      return [ResourcesIds["Wheat"], ResourcesIds["Fish"]].concat(
        unpackedResources,
      );
    } else {
      return [];
    }
  }, [realm]);

  // TODO: use config file
  let laborConfig = {
    base_food_per_cycle: 14000,
    base_labor_units: 7200,
    base_resources_per_cycle: 21,
  };

  return (
    <div className="flex flex-col">
      <SortPanel className="px-3 py-2">
        {sortingParams.map(({ label, sortKey, className }) => (
          <SortButton
            className={className}
            key={sortKey}
            label={label}
            sortKey={sortKey}
            activeSort={activeSort}
            onChange={(_sortKey, _sort) => {
              setActiveSort({
                sortKey: _sortKey,
                sort: _sort,
              });
            }}
          />
        ))}
      </SortPanel>
      {buildResource && (
        <LaborBuildPopup
          resourceId={buildResource}
          resources={realmResources}
          onClose={() => setBuildResource(null)}
          setBuildLoadingStates={setBuildLoadingStates}
        />
      )}
      {realm &&
        realmResourceIds.map((resourceId) => (
          <div className="flex flex-col p-2" key={resourceId}>
            <LaborComponent
              onBuild={() => {
                buildResource == resourceId
                  ? setBuildResource(null)
                  : setBuildResource(resourceId);
              }}
              resourceId={resourceId}
              labor={realmLabor[resourceId]}
              resource={realmResources[resourceId]}
              realm={realm}
              laborConfig={laborConfig as LaborConfig}
              setBuildLoadingStates={setBuildLoadingStates}
              buildLoadingStates={buildLoadingStates}
            />
          </div>
        ))}
    </div>
  );
};
