import { useSearchParams } from "react-router-dom";

import { useLayout } from "@/shell/frame/layout";
import { DAY_BANNER_CASES } from "@/ui/features/frontier/day/day-banner-fixtures";
import { DayBannerView } from "@/ui/features/frontier/day/day-banner-view";

const NAMES = Object.keys(DAY_BANNER_CASES) as (keyof typeof DAY_BANNER_CASES)[];

/** `/lab/season-one/day-banner?case=<n>`: the day's banner on its fixtures, in the window's own layout. */
export function DayBannerLab() {
  const [params, setParams] = useSearchParams();
  const layout = useLayout() === "phone" ? "phone" : "desktop";
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
      <div data-day-banner className="w-full max-w-sm">
        <DayBannerView {...DAY_BANNER_CASES[NAMES[index]!]} layout={layout} />
      </div>
    </div>
  );
}
