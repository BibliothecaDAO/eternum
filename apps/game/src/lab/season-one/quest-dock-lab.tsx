import { useSearchParams } from "react-router-dom";

import { QUEST_DOCK_CASES } from "@/ui/features/frontier/day/quest-dock-fixtures";
import { QuestDockView } from "@/ui/features/frontier/day/quest-dock-view";

const NAMES = Object.keys(QUEST_DOCK_CASES) as (keyof typeof QUEST_DOCK_CASES)[];

/** `/lab/season-one/quest-dock?case=<n>`: the day's quest and bane as their Aspect speaks them, on its fixtures. */
export function QuestDockLab() {
  const [params, setParams] = useSearchParams();
  const index = Math.min(Number(params.get("case") ?? 0) || 0, NAMES.length - 1);
  return (
    <div className="flex flex-col gap-2 p-3">
      <nav className="flex flex-wrap gap-2">
        {NAMES.map((name, each) => (
          <button key={name} aria-pressed={each === index} onClick={() => setParams({ case: String(each) })}>
            {name}
          </button>
        ))}
      </nav>
      <div data-quest-dock-lab className="w-full max-w-2xl">
        <QuestDockView {...QUEST_DOCK_CASES[NAMES[index]!]} />
      </div>
    </div>
  );
}
