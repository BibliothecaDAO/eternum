import { useState } from "react";
import { useSearchParams } from "react-router-dom";

import { HudSetting, HudSwitch } from "@/ui/design-system/kit/hud-elements";
import { OPENING_WORDS } from "@/ui/design-system/kit/words";
import { OPENING, OPENING_MOMENTS, partShown, type OpeningMoment } from "@/ui/features/frontier/opening/opening";
import { OPENING_RULES } from "@/ui/features/frontier/opening/opening-fixtures";
import { OpeningLineView } from "@/ui/features/frontier/opening/opening-line-view";

const PARTS = OPENING_MOMENTS.flatMap((moment) => OPENING[moment].parts);

/**
 * `/lab/season-one/opening?case=<n>`: the first n+1 moments reached (0, the launch); press a moment to reach it and see
 * its line and the HUD parts it opens; the switch is Show everything.
 */
export function OpeningLab() {
  const [params] = useSearchParams();
  const first = Math.min(Number(params.get("case") ?? 0) || 0, OPENING_MOMENTS.length - 1);
  const [reached, setReached] = useState<ReadonlySet<OpeningMoment>>(new Set(OPENING_MOMENTS.slice(0, first + 1)));
  const [latest, setLatest] = useState<OpeningMoment>(OPENING_MOMENTS[first]!);
  const [all, setAll] = useState(false);
  const reach = (moment: OpeningMoment) => {
    setReached(new Set([...reached, moment]));
    setLatest(moment);
  };
  const opened = all ? "all" : reached;
  return (
    <div className="flex max-w-md flex-col gap-3 p-3">
      <nav className="flex flex-wrap gap-2">
        {OPENING_MOMENTS.map((moment) => (
          <button key={moment} aria-pressed={reached.has(moment)} onClick={() => reach(moment)}>
            {moment}
          </button>
        ))}
        <button onClick={() => setReached(new Set(["launch"]))}>Reset</button>
      </nav>
      <div data-opening-line>
        <OpeningLineView moment={latest} rules={OPENING_RULES} onGotIt={() => setLatest("launch")} />
      </div>
      <HudSetting name={OPENING_WORDS.showEverything}>
        <HudSwitch on={all} label={OPENING_WORDS.showEverything} onChange={setAll} />
      </HudSetting>
      <ul data-opening-parts className="flex flex-wrap gap-2">
        {PARTS.map((part) => (
          <li key={part} data-part={part} data-shown={partShown(opened, part)}>
            {partShown(opened, part) ? `✔ ${part}` : `· ${part}`}
          </li>
        ))}
      </ul>
    </div>
  );
}
