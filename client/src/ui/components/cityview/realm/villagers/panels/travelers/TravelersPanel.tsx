import { useMemo, useState } from "react";
import { Traveler } from "./Traveler";
import { SortPanel } from "../../../../../../elements/SortPanel";
import { SortButton, SortInterface } from "../../../../../../elements/SortButton";
import useRealmStore from "../../../../../../hooks/store/useRealmStore";
import { getTravelersNpcs } from "../../utils";
import { useDojo } from "../../../../../../DojoContext";

export const TravelersPanel = () => {
  const {
    setup: {
      components: { Npc: NpcComponent, EntityOwner },
    },
  } = useDojo();
  const { realmEntityId } = useRealmStore();

  const travelers = getTravelersNpcs(realmEntityId, NpcComponent, EntityOwner);

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

      {travelers.map((npc) => (
        <div className="flex flex-col p-2" key={npc.entityId}>
          <Traveler npc={npc} />
        </div>
      ))}
    </div>
  );
};
