import { useSearchParams } from "react-router-dom";

import { DEEP_SITE_CASES } from "@/ui/features/frontier/deep/deep-site-fixtures";
import { DeepSiteView } from "@/ui/features/frontier/deep/deep-site-view";

const NAMES = Object.keys(DEEP_SITE_CASES) as (keyof typeof DEEP_SITE_CASES)[];

/** `/lab/season-one/deep-site?case=<n>`: the Deep site card on its fixtures, one state at a time. */
export function DeepSiteLab() {
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
      <DeepSiteView {...DEEP_SITE_CASES[NAMES[index]!]} onClose={() => setParams({ case: "0" })} />
    </div>
  );
}
