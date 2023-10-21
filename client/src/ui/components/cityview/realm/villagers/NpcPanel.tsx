import { useEffect, useMemo, useState } from "react";
// import { SortPanel } from "../../../../elements/SortPanel";
// import { SortButton, SortInterface } from "../../../../elements/SortButton";
import { NpcComponent } from "./NpcComponent";
import Button from "../../../../elements/Button";

import useRealmStore from "../../../../hooks/store/useRealmStore";
import { ResourcesIds } from "@bibliothecadao/eternum";
import { useRoute } from "wouter";
import { getRealm } from "../../../../utils/realms";
import { runQuery } from "@latticexyz/recs";
import { HasValue } from "@latticexyz/recs";
import { useDojo } from "../../../../DojoContext";

type NpcPanelProps = {
  type?: "all" | "farmers" | "miners";
};

export const NpcPanel = ({ type = "all" }: NpcPanelProps) => {
  const {
    setup: {
      components: { Npc },
      systemCalls: { spawn_npc },
      //   Not using this as the optimistic function isn't implemented
      //   optimisticSystemCalls: { optimisticSpawnNpc },
    },
    account: { account },
  } = useDojo();

  // @ts-ignore
  // TODO remove any
  const [match, params]: any = useRoute("/realm/:id/:tab");

  useEffect(() => {}, [params]);

  //   const sortingParams = useMemo(() => {
  //     return [
  //       { label: "Number", sortKey: "number", className: "mr-auto" },
  //       { label: "Balance", sortKey: "balance", className: "mr-auto" },
  //       { label: "Expires", sortKey: "expires", className: "mr-auto" },
  //       { label: "Harvested", sortKey: "harvested", className: "mr-auto" },
  //     ];
  //   }, []);

  //   const [activeSort, setActiveSort] = useState<SortInterface>({
  //     sortKey: "number",
  //     sort: "none",
  //   });

  const { realmEntityId } = useRealmStore();

  const realm = useMemo(() => {
    return realmEntityId ? getRealm(realmEntityId) : undefined;
  }, [realmEntityId]);

  // unpack the resources
  let npcs = useMemo(() => {
    if (realm) {
      let allNpcs = runQuery([HasValue(Npc, {})]);
      console.log(allNpcs);
    } else {
      return [];
    }
  }, [realm]);

  const spawnNpc = async () => {
    console.log(account);
    let npcId = await spawn_npc({ signer: account, realm_entity_id: realmEntityId });
    console.log(npcId);
  };

  return (
    <div className="flex flex-col min-h-[50px] relative pb-3">
      {/* <SortPanel className="px-3 py-2">
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
      </SortPanel> */}
      {/* {realm &&
        realmResourceIds.map((resourceId) => (
          <div className="flex flex-col p-2" key={resourceId}>
            <NpcComponent
              //   onBuild={() => {
              //     buildResource == resourceId ? setBuildResource(null) : setBuildResource(resourceId);
              //   }}
              entityId={resourceId}
              realm={realm}
              //   setBuildLoadingStates={setBuildLoadingStates}
              //   buildLoadingStates={buildLoadingStates}
            />
          </div>
        ))} */}
      <div className="flex flex-col p-2 space-y-2"></div>
      <Button
        className="sticky w-32 -translate-x-1/2 bottom-2 left-1/2 !rounded-full"
        onClick={() => spawnNpc()}
        variant="primary"
      >
        + Spawn villager
      </Button>
    </div>
  );
};
