import "./aspect-emissary-dock.css";

import { useEffect, useRef, useState } from "react";

import { AspectMark } from "@/ui/design-system/aspect-mark";
import { Icon } from "@/ui/design-system/icon";
import { useOpenFrameLabels } from "@/ui/design-system/kit/open-frames";
import { CLOSE, OPENING_WORDS, type OpeningRules } from "@/ui/design-system/kit/words";
import { OPENING, teacherAspectOf, type OpeningMoment } from "../opening/opening";
import type { TutorialDisplayStatus } from "../opening/opening-state";
import { resolveAspectEmissary } from "./aspect-emissaries";

const CONFIRM_MS = 6_000;

type DockForm = "card" | "strip" | "reminder";

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
  const [skipAskedOn, setSkipAskedOn] = useState<OpeningMoment | null>(null);
  const openFrames = useOpenFrameLabels();
  const [expanded, setExpanded] = useState(false);
  const framesOpen = openFrames.join("\n");
  useEffect(() => {
    setExpanded(false);
  }, [framesOpen]);
  if (aspectId === null) return null;
  const emissary = resolveAspectEmissary(aspectId);
  const phone = layout === "phone";
  const completedLine =
    moment in OPENING_WORDS.completed
      ? OPENING_WORDS.completed[moment as keyof typeof OPENING_WORDS.completed]
      : undefined;
  const completed = status === "completed" && completedLine !== undefined;
  const askingSkip = !completed && onSkipAll !== undefined && skipAskedOn === moment;
  const title = OPENING_WORDS.titles[moment];
  const form = dockForm({
    phone,
    openFrames,
    asks: "asks" in spec ? spec.asks.sheet : undefined,
    confirming: status === "completed",
    expanded,
  });
  const skip = onSkipAll && !completed && (
    <SkipControls
      asking={askingSkip}
      onAsk={() => setSkipAskedOn(moment)}
      onKeep={() => setSkipAskedOn(null)}
      onSkip={onSkipAll}
    />
  );
  const done = completed && (
    <span className="emissary-dock__done" role="status">
      ✓ {OPENING_WORDS.completedLabel}
    </span>
  );
  const portrait = (size: number) => (
    <Icon name={emissary.portrait} size={size} alt={emissary.name} className="emissary-dock__portrait" />
  );

  return (
    <aside
      ref={dock}
      data-tutorial-dock={moment}
      data-tutorial-aspect={aspectId}
      data-tutorial-layout={layout}
      data-tutorial-status={status}
      data-tutorial-form={form}
      aria-label={`${emissary.name}: ${title}`}
      className={`emissary-dock emissary-dock--${form} pointer-events-auto${phone ? " emissary-dock--phone" : ""}${completed ? " emissary-dock--completed" : ""}`}
      style={emissary.style}
    >
      {form === "reminder" ? (
        <>
          <span className="emissary-dock__fold-portrait">{portrait(22)}</span>
          <span className="emissary-dock__fold-label">{OPENING_WORDS.tutorial}</span>
          <span className="emissary-dock__fold-title">{title}</span>
          <button
            type="button"
            className="emissary-dock__btn emissary-dock__fold-btn"
            aria-label={OPENING_WORDS.showLesson}
            onClick={() => setExpanded(true)}
          >
            ▾
          </button>
          <button
            type="button"
            className="emissary-dock__btn emissary-dock__fold-btn"
            aria-label={CLOSE}
            onClick={onDismiss}
          >
            ✕
          </button>
        </>
      ) : form === "strip" ? (
        <>
          <span className="emissary-dock__fold-portrait">{portrait(32)}</span>
          <span className="emissary-dock__strip-text">
            <span className="emissary-dock__strip-title">{title}</span>
            <span className="emissary-dock__strip-line">
              {completed ? completedLine : askingSkip ? OPENING_WORDS.skipFinal : "asks" in spec ? spec.asks.line(rules) : null}
            </span>
          </span>
          <span className="emissary-dock__controls">
            {done}
            {skip}
          </span>
        </>
      ) : (
        <>
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
            <div className="emissary-dock__portrait-frame">{portrait(phone ? 54 : 68)}</div>
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
                {done}
                {skip}
                {!askingSkip && (
                  <button type="button" className="emissary-dock__btn" aria-label={CLOSE} onClick={onDismiss}>
                    ✕
                  </button>
                )}
              </span>
            </div>

            <p className="emissary-dock__speech">
              <span>
                {completed ? completedLine : askingSkip ? OPENING_WORDS.skipFinal : OPENING_WORDS.lines[moment](rules)}
              </span>
              {!completed && !askingSkip && (
                <span className="emissary-dock__action">
                  <Icon name={spec.icon} size={15} />
                  <span>{OPENING_WORDS.actions[moment]}</span>
                </span>
              )}
            </p>
          </div>
        </>
      )}
    </aside>
  );
}

const dockForm = (dock: {
  phone: boolean;
  openFrames: readonly string[];
  asks: string | undefined;
  confirming: boolean;
  expanded: boolean;
}): DockForm => {
  if (!dock.phone || dock.openFrames.length === 0) return "card";
  if (dock.confirming || (dock.asks !== undefined && dock.openFrames.includes(dock.asks))) return "strip";
  return dock.expanded ? "card" : "reminder";
};

const SkipControls = ({
  asking,
  onAsk,
  onKeep,
  onSkip,
}: {
  asking: boolean;
  onAsk: () => void;
  onKeep: () => void;
  onSkip: () => void;
}) => (
  <>
    <button type="button" className="emissary-dock__btn" onClick={asking ? onSkip : onAsk}>
      {OPENING_WORDS.skipTutorial}
    </button>
    {asking && (
      <button type="button" className="emissary-dock__btn" onClick={onKeep}>
        {OPENING_WORDS.keepTutorial}
      </button>
    )}
  </>
);

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
