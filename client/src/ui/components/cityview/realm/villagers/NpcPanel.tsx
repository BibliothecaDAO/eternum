import { useEffect, useMemo, useState } from "react";
import Button from "../../../../elements/Button";
import NpcChat from "./NpcChat";
import { Npc } from "./types";
import { ChatMessageProps } from "../../../../elements/ChatMessage";
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
      components: { Npc: NpcComponent },
      systemCalls: { spawn_npc, change_mood },
      // Not using this as the optimistic function isn't implemented
      optimisticSystemCalls: { optimisticSpawnNpc },
    },
    account: { account },
  } = useDojo();
  const [spawned, setSpawned] = useState(false);
  const [genMsg, setGenMsg] = useState(false);
  // @ts-ignore
  // TODO remove any
  const [match, params]: any = useRoute("/realm/:id/:tab");

  useEffect(() => {}, [params]);

  const { realmEntityId } = useRealmStore();

  const realm = useMemo(() => {
    return realmEntityId ? getRealm(realmEntityId) : undefined;
  }, [realmEntityId]);

  let npcs = useMemo(() => {
    if (realm) {
      const entityIds = runQuery([HasValue(NpcComponent, { realm_id: realm.realm_id })]);
      let npcs: Npc[] = Array.from(entityIds).map((entityId) => {
        let npc = getComponentValue(NpcComponent, entityId);
        return { ...npc, entityId, mood: parseMoodFeltToStruct(npc.mood) };
      });
      setSpawned(false);
      return npcs;
    } else {
      return [];
    }
  }, [spawned]);

  const spawnNpc = async () => {
    console.log("Spawning NPC");
    // Optimistic call for now is useless as the normal call work completely fine
    await optimisticSpawnNpc(spawn_npc)({ signer: account, realm_id: realm.realm_id });
    setSpawned(true);
  };

  const randomizeMood = async () => {
    console.log("randomizing NPC");
    // await change_mood()
  };

  return (
    <div className="flex flex-col h-[250px] relative pb-3">
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
          disabled={npcs.length >= 5}
          className="mx-1 top-3 sticky w-32 bottom-2 !rounded-full"
          onClick={() => spawnNpc()}
          variant="primary"
        >
          {npcs.length > 5 ? "+ Village full" : "Spawn villager"}
        </Button>
        <Button
          className="mx-1 top-3 left-3 sticky w-32 bottom-2 !rounded-full"
          onClick={() => {
            setGenMsg(true);
          }}
          variant="primary"
        >
          👋 Greet villagers!
        </Button>
        <Button
          className="mx-1 top-3 left-3 sticky w-32 bottom-2 !rounded-full"
          onClick={() => randomizeMood()}
          variant="primary"
        >
          Randomize mood
        </Button>
      </div>
      <NpcChat npcs={npcs} genMsg={genMsg} setGenMsg={setGenMsg} />
    </div>
  );
};
