import { useMemo, useState } from "react";
import { AtGatesNpc } from "./AtGatesNpc";
import { SortPanel } from "../../../../../../elements/SortPanel";
import { SortButton, SortInterface } from "../../../../../../elements/SortButton";
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

  const sortingParams = useMemo(() => {
    return [
      { label: "Age", sortKey: "number", className: "mr-4" },
      { label: "Role", sortKey: "balance", className: "" },
    ];
  }, []);

  const [activeSort, setActiveSort] = useState<SortInterface>({
    sortKey: "number",
    sort: "none",
  });

  return (
    <div className="flex flex-col">
      <SortPanel className="flex justify-center px-3 py-2">
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

      {atGatesNpcs.foreigners.map((npc) => (
        <div className="flex flex-col p-2" key={npc.entityId}>
          <AtGatesNpc npc={npc} native={false} />
        </div>
      ))}
      {atGatesNpcs.natives.map((npc) => (
        <div className="flex flex-col p-2" key={npc.entityId}>
          <AtGatesNpc npc={npc} native={true} />
        </div>
      ))}
    </div>
  );
};
