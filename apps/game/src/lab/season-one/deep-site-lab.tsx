import { useSearchParams } from "react-router-dom";

import { DEEP_SITE_CASES } from "@/ui/features/frontier/deep/deep-site-fixtures";
import { DeepSiteView } from "@/ui/features/frontier/deep/deep-site-view";

const NAMES = Object.keys(DEEP_SITE_CASES) as (keyof typeof DEEP_SITE_CASES)[];

export function DeepSiteLab() {
  const [params, setParams] = useSearchParams();
  const all = params.get("case") === "all";
  const index = Math.min(Number(params.get("case") ?? 0) || 0, NAMES.length - 1);
  const shown = all ? NAMES : [NAMES[index]!];
  return (
    <div className="flex flex-col gap-2 p-3">
      <nav className="flex flex-wrap gap-2">
        {NAMES.map((name, each) => (
          <button key={name} aria-pressed={!all && each === index} onClick={() => setParams({ case: String(each) })}>
            {name}
          </button>
        ))}
        <button aria-pressed={all} onClick={() => setParams({ case: "all" })}>
          All
        </button>
      </nav>
      <div
        data-deep-lab
        className={
          all
            ? "grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] items-start gap-3 [&_.ui-sheet]:static [&_.ui-sheet]:max-h-none"
            : undefined
        }
      >
        {shown.map((name) => (
          <DeepSiteView key={name} {...DEEP_SITE_CASES[name]} onClose={() => setParams({ case: "0" })} />
        ))}
      </div>
    </div>
  );
}
