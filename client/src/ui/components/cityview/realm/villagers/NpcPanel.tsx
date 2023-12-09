import { useEffect, useMemo, useState } from "react";
import Button from "../../../../elements/Button";
import NpcChat from "./NpcChat";
import { Npc } from "./types";
import useRealmStore from "../../../../hooks/store/useRealmStore";
import { useRoute } from "wouter";
import { getRealm } from "../../../../utils/realms";
import { HasValue, getComponentValue, runQuery } from "@latticexyz/recs";
import { useDojo } from "../../../../DojoContext";
import { getRandomMood, parseMoodFeltToStruct } from "./utils";
import { random } from "@latticexyz/utils";
import { useNpcs } from "../../../../NpcContext";
import useWebSocket, { ReadyState } from "react-use-websocket";

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

  const { sendJsonMessage, lastJsonMessage, readyState } = useWebSocket(import.meta.env.VITE_OVERLORE_WS_URL, {
    share: false,
    shouldReconnect: () => true,
  });

  useEffect(() => {
    console.log("Connection state changed");
  }, [readyState]);

  // Run when a new WebSocket message is received (lastJsonMessage)
  useEffect(() => {
    console.log(`Got a new message: ${JSON.stringify(lastJsonMessage, null, 2)}`);
  }, [lastJsonMessage]);

  const [spawned, setSpawned] = useState(false);
  const { setGenMsg, setType } = useNpcs();
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

  const genTownHall = async () => {
    // Optimistic call for now is useless as the normal call work completely fine
    // await optimisticSpawnNpc(spawn_npc)({ signer: account, realm_id: realm.realm_id });
    if (readyState === ReadyState.OPEN) {
      sendJsonMessage({
        // Replace with this after demo version
        // user: realm.realm_id,
        user: 0,
        day: 0,
      });
    }
    setSpawned(true);
  };

  const randomizeMood = async () => {
    console.log("randomizing NPC");
    const npc = npcs[random(npcs.length - 1, 0)];
    // Should we do optimistic call?
    await change_mood({
      realm_id: npc.realm_id.valueOf(),
      npc_id: npc.entityId,
      mood: getRandomMood(),
      signer: account,
    });
  };

  const generateVillagerMessage = () => {
    setGenMsg(true);
    setType("random");
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
          onClick={() => genTownHall()}
          variant="primary"
        >
          {spawned ? "Townhall is generated" : "Generate townhall"}
        </Button>
        <Button
          className="mx-1 top-3 left-3 sticky w-32 bottom-2 !rounded-full"
          onClick={generateVillagerMessage}
          disabled={npcs.length == 0}
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
      <NpcChat npcs={npcs} realmId={realm.realm_id} />
    </div>
  );
};
