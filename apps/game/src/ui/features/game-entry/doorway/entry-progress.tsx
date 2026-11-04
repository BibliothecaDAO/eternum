import { useEffect, useRef, useState } from "react";

import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import { AppPanel } from "@/ui/design-system/kit/app-elements";
import { DOORWAY_WORDS } from "@/ui/design-system/kit/words";

import type { DoorwayView } from "./doorway-view";

/**
 * The doorway's one bar (the owner's pick A, 4 November 2026): what runs now and its share done, the step of the
 * track, and the time left once the rate is known. A meter, never a control: nothing in it looks pressable.
 */
export const EntryProgress = ({ view }: { view: DoorwayView }) => {
  const running = view.steps.find(({ state }) => state !== "done") ?? view.steps[view.steps.length - 1];
  const percent = useNeverBack(view.percent);
  const left = useSecondsLeft(percent);
  return (
    <section aria-label={DOORWAY_WORDS.entering} className="flex w-full flex-col gap-2 text-app-ink">
      <div className="flex items-baseline justify-between gap-3 font-semibold">
        <span>{DOORWAY_WORDS[running.step]}</span>
        <span className="tabular-nums">{`${percent}%`}</span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-3 w-full overflow-hidden rounded-full bg-black/40"
      >
        <div
          className="h-full rounded-full bg-[rgb(var(--app-gold))] transition-[width] duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="flex items-center justify-between gap-3 text-sm opacity-75">
        <span>{DOORWAY_WORDS.stepOf(view.steps.indexOf(running) + 1, view.steps.length)}</span>
        {left !== null && (
          <span className="flex items-center gap-1">
            <Icon name="hourglass" size={16} />
            {DOORWAY_WORDS.secondsLeft(left)}
          </span>
        )}
      </div>
    </section>
  );
};

/** What a Frontier player's first minutes hold, said while their map loads: the day's claim, then the first build. */
export const ComingUp = () => (
  <AppPanel className="w-full">
    <ul className="flex flex-col gap-3 text-left text-app-ink">
      <Tip icon="labor" title={DOORWAY_WORDS.claimTitle} detail={DOORWAY_WORDS.claimDetail} />
      <Tip icon="barracks" title={DOORWAY_WORDS.firstTitle} detail={DOORWAY_WORDS.firstDetail} />
    </ul>
  </AppPanel>
);

const Tip = ({ icon, title, detail }: { icon: IconMeaning; title: string; detail: string }) => (
  <li className="flex items-center gap-3">
    <Icon name={icon} size={40} />
    <span className="flex flex-col">
      <span className="font-semibold">{title}</span>
      <span className="text-sm opacity-75">{detail}</span>
    </span>
  </li>
);

/** The highest share seen: a load that starts more files lowers the raw share, but the bar never goes back. */
const useNeverBack = (percent: number): number => {
  const [highest, setHighest] = useState(percent);
  useEffect(() => {
    setHighest((seen) => Math.max(seen, percent));
  }, [percent]);
  return Math.max(highest, percent);
};

/**
 * Seconds left at the rate the bar has moved since this screen opened, rounded up to 5; none until it has moved 5
 * points over 3 s, nor under 10 s, where a count would only flicker.
 */
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
