import { useEffect, useMemo, useState } from "react";
import { NpcComponent } from "./NpcComponent";
import Button from "../../../../elements/Button";
import NpcChat from "./NpcChat";

import useRealmStore from "../../../../hooks/store/useRealmStore";
import { useRoute } from "wouter";
import { getRealm } from "../../../../utils/realms";
import { HasValue, getComponentValue, runQuery } from "@latticexyz/recs";
import { useDojo } from "../../../../DojoContext";
import { parseMoodFeltToStruct } from "./utils";

type NpcPanelProps = {
  type?: "all" | "farmers" | "miners";
};

export const NpcPanel = ({ type = "all" }: NpcPanelProps) => {
  const {
    setup: {
      components: { Npc },
      systemCalls: { spawn_npc, change_mood },
      //   Not using this as the optimistic function isn't implemented
      //   optimisticSystemCalls: { optimisticSpawnNpc },
    },
    account: { account },
  } = useDojo();
  const [spawned, setSpawned] = useState(false);
  // @ts-ignore
  // TODO remove any
  const [match, params]: any = useRoute("/realm/:id/:tab");

  useEffect(() => {}, [params]);

  const { realmEntityId } = useRealmStore();

  const realm = useMemo(() => {
    return realmEntityId ? getRealm(realmEntityId) : undefined;
  }, [realmEntityId]);

  // unpack the resources
  let npcs = useMemo(() => {
    if (realm) {
      const entityIds = runQuery([HasValue(Npc, { realm_id: realm.realm_id })]);
      let npcs = Array.from(entityIds).map((entityId) => {
        let npc = getComponentValue(Npc, entityId);
        return { ...npc, mood: parseMoodFeltToStruct(npc.mood) };
      });
      setSpawned(false);
      return npcs;
    } else {
      return [];
    }
  }, [spawned]);

  useEffect(() => {
    console.log(npcs);
  }, [npcs]);

  const spawnNpc = async () => {
    console.log("Spawning NPC");
    await spawn_npc({ signer: account, realm_id: realm.realm_id });
    setSpawned(true);
  };

  const randomizeMood = async () => {
    console.log("randomizing NPC");
    // await change_mood()
  };

  return (
    <div className="flex flex-col min-h-[200px] h-[100%] relative pb-3">
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
      <div className="flex flex-row w-[100%] items-center space-y-2" style={{ justifyContent: "center" }}>
        <Button
          className="-translate-x-2 top-3 sticky w-32 bottom-2 !rounded-full"
          onClick={() => spawnNpc()}
          variant="primary"
        >
          + Spawn villager
        </Button>
        <Button
          className="translate-x-2 top-3 left-3 sticky w-32 bottom-2 !rounded-full"
          onClick={() => randomizeMood()}
          variant="primary"
        >
          Randomize mood
        </Button>
      </div>
      <NpcChat npcs={npcs} />
    </div>
  );
};
