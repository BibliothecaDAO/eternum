import { formatPercent } from "@bibliothecadao/types";
import { useEffect, useRef, useState } from "react";

import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import { DOORWAY_WORDS } from "@/ui/design-system/kit/words";

import type { DoorwayView } from "./doorway-view";

export const EntryProgress = ({ view, showTip = false }: { view: DoorwayView; showTip?: boolean }) => {
  const running = view.steps.find(({ state }) => state !== "done") ?? view.steps[view.steps.length - 1];
  const percent = useNeverBack(view.percent);
  const left = useSecondsLeft(percent);
  return (
    <section aria-label={DOORWAY_WORDS.entering} className="doorway-progress">
      <div className="doorway-progress__header">
        {showTip && (
          <DoorwayTip icon="barracks" title={DOORWAY_WORDS.firstTitle} detail={DOORWAY_WORDS.firstDetail} />
        )}
        <div className="doorway-progress__status">
          <span className="doorway-progress__step">
            <span>{DOORWAY_WORDS[running.step]}</span>
            <span className="doorway-progress__sub">
              {DOORWAY_WORDS.stepOf(view.steps.indexOf(running) + 1, view.steps.length)}
            </span>
            {left !== null && (
              <span className="doorway-progress__sub flex items-center gap-1">
                <Icon name="hourglass" size={14} />
                {DOORWAY_WORDS.secondsLeft(left)}
              </span>
            )}
          </span>
          <span className="doorway-progress__percent">{formatPercent(percent / 100)}</span>
        </div>
      </div>
      <div role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} className="doorway-bar">
        <div className="doorway-bar__fill" style={{ width: `${percent}%` }} />
      </div>
    </section>
  );
};

const DoorwayTip = ({ icon, title, detail }: { icon: IconMeaning; title: string; detail?: string }) => (
  <div className="doorway-tip">
    <Icon name={icon} size={32} />
    <span className="doorway-tip__words">
      <span>{title}</span>
      {detail && <span className="doorway-tip__detail">{detail}</span>}
    </span>
  </div>
);

const useNeverBack = (percent: number): number => {
  const [highest, setHighest] = useState(percent);
  useEffect(() => {
    setHighest((seen) => Math.max(seen, percent));
  }, [percent]);
  return Math.max(highest, percent);
};

const useSecondsLeft = (percent: number): number | null => {
  const start = useRef<{ at: number; percent: number } | null>(null);
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const now = Date.now();
    if (start.current === null) {
      start.current = { at: now, percent };
      return;
    }
    const gained = percent - start.current.percent;
    const elapsed = (now - start.current.at) / 1000;
    const seconds = gained < 5 || elapsed < 3 ? null : (elapsed * (100 - percent)) / gained;
    setLeft(seconds === null || seconds < 10 ? null : Math.ceil(seconds / 5) * 5);
  }, [percent]);
  return left;
};
