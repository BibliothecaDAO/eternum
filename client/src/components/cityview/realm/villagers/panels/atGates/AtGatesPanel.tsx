import { AtGatesNpc } from "./AtGatesNpc";
import useRealmStore from "../../../../../../hooks/store/useRealmStore";
import { getAtGatesNpcs } from "../../utils";
import { useDojo } from "../../../../../../DojoContext";
import useBlockchainStore from "../../../../../../hooks/store/useBlockchainStore";

export const AtGatesPanel = () => {
  const {
    setup: {
      components: { Npc: NpcComponent, Position, ArrivalTime, EntityOwner },
    },
  } = useDojo();
  const { nextBlockTimestamp } = useBlockchainStore();
  const { realmId, realmEntityId } = useRealmStore();

  const atGatesNpcs = getAtGatesNpcs(
    realmId!,
    realmEntityId!,
    nextBlockTimestamp!,
    NpcComponent,
    Position,
    ArrivalTime,
    EntityOwner,
  );

  return (
    <div className="flex flex-col">
      {atGatesNpcs.map((atGatesNpc) => (
        <div className="flex flex-col p-2" key={atGatesNpc.npc.entityId}>
          <AtGatesNpc npc={atGatesNpc.npc} />
        </div>
      ))}
    </div>
  );
};
