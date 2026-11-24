import "./aspect-emissary-dock.css";

import { useEffect, useRef } from "react";

import { AspectMark } from "@/ui/design-system/aspect-mark";
import { Icon } from "@/ui/design-system/icon";
import { CLOSE, OPENING_WORDS, type OpeningRules } from "@/ui/design-system/kit/words";
import { OPENING, teacherAspectOf, type OpeningMoment } from "../opening/opening";
import type { TutorialDisplayStatus } from "../opening/opening-state";
import { resolveAspectEmissary } from "./aspect-emissaries";

const CONFIRM_MS = 6_000;

export interface AspectEmissaryDockProps {
  readonly moment: OpeningMoment;
  readonly rules: OpeningRules;
  readonly layout?: "desktop" | "phone";
  readonly status?: TutorialDisplayStatus;
  readonly onDismiss: () => void;
  readonly onSkipAll?: () => void;
}

export function AspectEmissaryDock({
  moment,
  rules,
  layout = "desktop",
  status = "showing",
  onDismiss,
  onSkipAll,
}: AspectEmissaryDockProps) {
  const spec = OPENING[moment];
  const aspectId = teacherAspectOf(moment, rules.ownAspect);
  const dock = useRetireOnceSeen(status === "completed" ? moment : null, onDismiss);
  if (aspectId === null) return null;
  const emissary = resolveAspectEmissary(aspectId);
  const phone = layout === "phone";
  const completedLine =
    moment in OPENING_WORDS.completed
      ? OPENING_WORDS.completed[moment as keyof typeof OPENING_WORDS.completed]
      : undefined;
  const completed = status === "completed" && completedLine !== undefined;
  const title = OPENING_WORDS.titles[moment];
  const line = completed ? completedLine : OPENING_WORDS.lines[moment](rules);
  const action = OPENING_WORDS.actions[moment];

  return (
    <aside
      ref={dock}
      data-tutorial-dock={moment}
      data-tutorial-aspect={aspectId}
      data-tutorial-layout={layout}
      data-tutorial-status={status}
      aria-label={`${emissary.name}: ${title}`}
      className={`emissary-dock pointer-events-auto${phone ? " emissary-dock--phone" : ""}${completed ? " emissary-dock--completed" : ""}`}
      style={emissary.style}
    >
      <span className="emissary-dock__corner emissary-dock__corner--tl" aria-hidden="true" />
      <span className="emissary-dock__corner emissary-dock__corner--tr" aria-hidden="true" />
      <span className="emissary-dock__corner emissary-dock__corner--bl" aria-hidden="true" />
      <span className="emissary-dock__corner emissary-dock__corner--br" aria-hidden="true" />
      <span className="emissary-dock__rivet emissary-dock__rivet--tl" aria-hidden="true" />
      <span className="emissary-dock__rivet emissary-dock__rivet--tr" aria-hidden="true" />
      <span className="emissary-dock__rivet emissary-dock__rivet--bl" aria-hidden="true" />
      <span className="emissary-dock__rivet emissary-dock__rivet--br" aria-hidden="true" />
      <span className="emissary-dock__crest" aria-hidden="true" />

      <div className="emissary-dock__portrait-bay">
        <div className="emissary-dock__portrait-frame">
          <Icon
            name={emissary.portrait}
            size={phone ? 54 : 68}
            alt={emissary.name}
            className="emissary-dock__portrait"
          />
        </div>
        <span className="emissary-dock__medallion">
          <AspectMark aspect={aspectId} size={phone ? 16 : 20} decorative />
        </span>
      </div>

      <div className="emissary-dock__body">
        <div className="emissary-dock__head">
          <span className="emissary-dock__speaker">
            <span className="emissary-dock__gem" aria-hidden="true" />
            <span className="emissary-dock__aspect">{emissary.name}</span>
            <span className="emissary-dock__title">· {title}</span>
          </span>
          <span className="emissary-dock__controls">
            {completed && (
              <span className="emissary-dock__done" role="status">
                ✓ {OPENING_WORDS.completedLabel}
              </span>
            )}
            {!completed && onSkipAll && (
              <button type="button" className="emissary-dock__btn" onClick={onSkipAll}>
                {OPENING_WORDS.skipTutorial}
              </button>
            )}
            <button type="button" className="emissary-dock__btn" aria-label={CLOSE} onClick={onDismiss}>
              ✕
            </button>
          </span>
        </div>

        <p className="emissary-dock__speech">
          <span>{line}</span>
          {!completed && (
            <span className="emissary-dock__action">
              <Icon name={spec.icon} size={15} />
              <span>{action}</span>
            </span>
          )}
        </p>
      </div>
    </aside>
  );
}

function useRetireOnceSeen(confirmed: OpeningMoment | null, retire: () => void) {
  const dock = useRef<HTMLElement>(null);
  const latestRetire = useRef(retire);
  latestRetire.current = retire;
  useEffect(() => {
    const element = dock.current;
    if (confirmed === null || !element) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onScreen = (visible: boolean) => {
      clearTimeout(timer);
      timer = visible ? setTimeout(() => latestRetire.current(), CONFIRM_MS) : undefined;
    };
    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver((entries) => onScreen(entries.some((entry) => entry.isIntersecting)));
    if (observer) observer.observe(element);
    else onScreen(true);
    return () => {
      clearTimeout(timer);
      observer?.disconnect();
    };
  }, [confirmed]);
  return dock;
}
