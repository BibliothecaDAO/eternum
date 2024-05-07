import { Headline } from "../../../../../../elements/Headline";
import { Villager } from "../../types";
import { SortInterface } from "../../../../../../elements/SortButton";

export const READY_TO_SPAWN = -1;

const HeadlineTitle: { [key: string]: string } = {
  residents: "Residents",
  travelers: "Travelers",
  atGates: "At Your Gates",
};

export const getNpcHeadline = (npc_count: number, title: string) => {
  return (
    <Headline className="px-10 my-2">
      <div className="flex flex-row text-light-pink">
        <p>{npc_count}</p>
        <div className="flex">
          <p className="ml-1">{HeadlineTitle[title]}</p>
        </div>
      </div>
    </Headline>
  );
};

export function sortVillagers(npcs: Villager[], activeSort: SortInterface): Villager[] | undefined {
  const sortedNpcs = [...npcs];

  if (activeSort.sort !== "none") {
    if (activeSort.sortKey === "fullName") {
      return sortedNpcs.sort((a, b) => {
        if (activeSort.sort === "asc") {
          return a.npc.fullName.localeCompare(b.npc.fullName);
        } else {
          return b.npc.fullName.localeCompare(a.npc.fullName);
        }
      });
    } else if (activeSort.sortKey === "role") {
      return sortedNpcs.sort((a, b) => {
        if (activeSort.sort === "asc") {
          return a.npc.characteristics.role.localeCompare(b.npc.characteristics.role);
        } else {
          return b.npc.characteristics.role.localeCompare(a.npc.characteristics.role);
        }
      });
    } else if (activeSort.sortKey === "age") {
      return sortedNpcs.sort((a, b) => {
        if (activeSort.sort === "asc") {
          return a.npc.characteristics.age - b.npc.characteristics.age;
        } else {
          return b.npc.characteristics.age - a.npc.characteristics.age;
        }
      });
    } else if (activeSort.sortKey === "sex") {
      return sortedNpcs.sort((a, b) => {
        if (activeSort.sort === "asc") {
          return a.npc.characteristics.sex.localeCompare(b.npc.characteristics.sex);
        } else {
          return b.npc.characteristics.sex.localeCompare(a.npc.characteristics.sex);
        }
      });
    }
  }
  return sortedNpcs;
}
