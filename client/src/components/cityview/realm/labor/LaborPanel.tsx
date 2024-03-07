import { useEffect, useMemo, useState } from "react";
import { SortPanel } from "../../../../elements/SortPanel";
import { SortButton, SortInterface } from "../../../../elements/SortButton";
import { LaborComponent } from "./LaborComponent";
import useRealmStore from "../../../../hooks/store/useRealmStore";
import { unpackResources } from "../../../../utils/packedData";
import { Guilds, ResourcesIds, resourcesByGuild } from "@bibliothecadao/eternum";
import { LaborBuildPopup } from "./LaborBuild";
import { useRoute } from "wouter";
import { getRealm } from "../../../../utils/realms";
import { useLevel } from "../../../../hooks/helpers/useLevel";
import { useBuildings } from "../../../../hooks/helpers/useBuildings";

type LaborPanelProps = {
  type?: "all" | "food" | "mines";
};

export const LaborPanel = ({ type = "all" }: LaborPanelProps) => {
  const [buildResource, setBuildResource] = useState<number | null>(null);
  const [buildLoadingStates, setBuildLoadingStates] = useState<{
    [key: number]: boolean;
  }>({});

  // @ts-ignore
  // TODO remove any
  const [match, params]: any = useRoute("/realm/:id/:tab");

  const { getLaborBuilding } = useBuildings();
  const laborBuilding = getLaborBuilding();

  useEffect(() => {
    if (params?.tab == "fish" && buildResource != ResourcesIds["Fish"]) {
      setBuildResource(ResourcesIds["Fish"]);
    }
    if (params?.tab == "farm" && buildResource != ResourcesIds["Wheat"]) {
      setBuildResource(ResourcesIds["Wheat"]);
    }
  }, [params]);

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

  let realmId = useRealmStore((state) => state.realmId);

  const realm = useMemo(() => {
    return realmId ? getRealm(realmId) : undefined;
  }, [realmId]);

  // unpack the resources
  let realmResourceIds = useMemo(() => {
    if (realm) {
      let unpackedResources = unpackResources(BigInt(realm.resourceTypesPacked), realm.resourceTypesCount);
      const foodResources = [ResourcesIds["Wheat"], ResourcesIds["Fish"]];
      if (type == "food") {
        return foodResources;
      }
      if (type == "mines") {
        return unpackedResources;
      }
      return foodResources.concat(unpackedResources);
    } else {
      return [];
    }
  }, [realm]);

  const realmEntityId = useRealmStore((state) => state.realmEntityId);
  const { getEntityLevel } = useLevel();
  const realm_level = getEntityLevel(realmEntityId)?.level;

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
          onClose={() => setBuildResource(null)}
          setBuildLoadingStates={setBuildLoadingStates}
        />
      )}
      {realm &&
        realmResourceIds.map((resourceId) => {
          const hasGuild = laborBuilding
            ? resourcesByGuild[Guilds[laborBuilding.building_type - 1]]?.includes(resourceId) || false
            : false;
          return (
            <div className="flex flex-col p-2" key={resourceId}>
              <LaborComponent
                hasGuild={hasGuild}
                setBuildResource={setBuildResource}
                resourceId={resourceId}
                realm={realm}
                setBuildLoadingStates={setBuildLoadingStates}
                buildLoadingStates={buildLoadingStates}
                locked={realm_level == 0 && resourceId <= 22}
              />
            </div>
          );
        })}
    </div>
  );
};
