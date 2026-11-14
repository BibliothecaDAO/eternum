import { useSearchParams } from "react-router-dom";

import { ASPECT_PAGE_CASES } from "@/ui/features/frontier/aspect/aspect-page-fixtures";
import { AspectPageView } from "@/ui/features/frontier/aspect/aspect-page-view";

const NAMES = Object.keys(ASPECT_PAGE_CASES) as (keyof typeof ASPECT_PAGE_CASES)[];

/** `/lab/season-one/race?case=<n>`: the Aspect page, the hyperstructure race and the player's Aspect, on its fixtures. */
export function AspectPageLab() {
  const [params, setParams] = useSearchParams();
  const index = Math.min(Number(params.get("case") ?? 0) || 0, NAMES.length - 1);
  return (
    <div data-aspect-page className="flex flex-col gap-2 p-3">
      <nav className="flex flex-wrap gap-2">
        {NAMES.map((name, each) => (
          <button key={name} aria-pressed={each === index} onClick={() => setParams({ case: String(each) })}>
            {name}
          </button>
        ))}
      </nav>
      <AspectPageView {...ASPECT_PAGE_CASES[NAMES[index]!]} onClose={() => setParams({ case: "0" })} />
    </div>
  );
}
