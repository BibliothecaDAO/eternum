import { useMemo, useState } from "react";
import { NpcListComponent } from "./NpcListComponent";
import { SortPanel } from "../../../../elements/SortPanel";
import { SortButton, SortInterface } from "../../../../elements/SortButton";

export const NpcListPanel = () => {

  const dummyNpcs = [
    {
      id: 1,
      name: "James",
      image: "/images/npc/default-npc.svg",
      age: 30,
      sex: 'male',
      role: 'farmer',
      hungriness: "starving",
      happiness: "miserable",
      belligerent: "peaceful",
      description: "Some description of an NPC.",
    },
    {
      id: 2,
      name: "John",
      image: "/images/npc/default-npc.svg",
      age: 80,
      sex: 'male',
      role: 'farmer',
      hungriness: "hungry",
      happiness: "happy",
      belligerent: "calm",
      description: "Description",
    },
    {
      id: 3,
      name: "Paul",
      image: "/images/npc/default-npc.svg",
      age: 80,
      sex: 'male',
      role: 'miner',
      hungriness: "full",
      happiness: "ecstatic",
      belligerent: "antagonistic",
      description: "Description",
    },
    {
      id: 4,
      name: "George",
      image: "/images/npc/default-npc.svg",
      age: 79,
      sex: 'male',
      role: 'soldier',
      hungriness: "overfed",
      happiness: "blissful",
      belligerent: "furious",
      description: "Description",
    },
    {
      id: 5,
      name: "Ringo",
      image: "/images/npc/default-npc.svg",
      age: 35,
      sex: 'male',
      role: 'merchant',
      hungriness: "famished",
      happiness: "ecstatic",
      belligerent: "hostile",
      description: "Description",
    },
  ];

  const sortingParams = useMemo(() => {
    return [
      { label: "Age", sortKey: "number", className: "mr-auto" },
      { label: "Role", sortKey: "balance", className: "mr-auto" },
      { label: "Happy", sortKey: "expires", className: "mr-auto" },
      { label: "Hungry", sortKey: "harvested", className: "mr-auto" },
      { label: "Beligr.", sortKey: "belligerent", className: "mr-auto" },
    ];
  }, []);

  const [activeSort, setActiveSort] = useState<SortInterface>({
    sortKey: "number",
    sort: "none",
  });

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
 
      {dummyNpcs.map((npc) => (
        <div className="flex flex-col p-2" key={npc.id}>
            <NpcListComponent
                npc={npc}
            />
        </div>
      ))}
    </div>
  );
};