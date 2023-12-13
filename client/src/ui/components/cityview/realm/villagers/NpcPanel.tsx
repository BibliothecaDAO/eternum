import { useEffect, useMemo, useState } from "react";
import Button from "../../../../elements/Button";
import NpcChat from "./NpcChat";
import useRealmStore from "../../../../hooks/store/useRealmStore";
import { useRoute } from "wouter";
import { getRealm } from "../../../../utils/realms";

type NpcPanelProps = {
  type?: "all" | "farmers" | "miners";
};

export const NpcPanel = ({ type = "all" }: NpcPanelProps) => {
  const [spawned, setSpawned] = useState(-1);

  const { realmEntityId } = useRealmStore();

  const realm = useMemo(() => {
    return realmEntityId ? getRealm(realmEntityId) : undefined;
  }, [realmEntityId]);

  return (
    <div className="flex flex-col h-[250px] relative pb-3">
      <div
        className="flex flex-row w-[100%] items-center space-y-2"
        style={{ position: "relative", justifyContent: "center", top: "2%" }}
      >
        <Button
          className="mx-1 top-3 left-3 w-32 bottom-2 !rounded-full"
          onClick={() => setSpawned(spawned + 1)}
          variant="primary"
        >
          Gather villagers
        </Button>
      </div>
      <NpcChat spawned={spawned} realmId={realm.realm_id} />
    </div>
  );
};
