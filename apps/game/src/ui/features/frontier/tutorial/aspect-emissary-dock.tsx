import "./aspect-emissary-dock.css";

import { type ReactNode, type Ref, useEffect, useRef, useState } from "react";

import type { AspectId } from "@bibliothecadao/types";

import { AspectMark } from "@/ui/design-system/aspect-mark";
import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import { useOpenFrames } from "@/ui/design-system/kit/open-frames";
import { OK, OPENING_WORDS, type OpeningRules } from "@/ui/design-system/kit/words";
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
  const openFrames = useOpenFrames();
  const framesOpen = openFrames.map((frame) => frame.opening).join();
  const [expandedOver, setExpandedOver] = useState<string | null>(null);
  if (aspectId === null) return null;
  const emissary = resolveAspectEmissary(aspectId);
  const phone = layout === "phone";
  const confirmation =
    moment in OPENING_WORDS.completed
      ? OPENING_WORDS.completed[moment as keyof typeof OPENING_WORDS.completed]
      : undefined;
  const completed = status === "completed" && confirmation !== undefined;
  const askingSkip = !completed && onSkipAll !== undefined && skipAskedOn === moment;
  const says = (lessonLine: string | undefined) =>
    completed ? confirmation.line : askingSkip ? OPENING_WORDS.skipFinal : lessonLine;
  const title = OPENING_WORDS.titles[moment](rules);
  const shownTitle = completed ? confirmation.title : title;
  const form = dockForm({
    phone,
    openFrames: openFrames.map((frame) => frame.label),
    asks: "asks" in spec ? spec.asks.sheet : undefined,
    confirming: status === "completed",
    expanded: expandedOver === framesOpen,
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

  const lessonLine = says(OPENING_WORDS.lines[moment](rules));
  const action = !completed && !askingSkip && (
    <span className="emissary-dock__action">
      <Icon name={spec.icon} size={15} />
      <span>{OPENING_WORDS.actions[moment]}</span>
    </span>
  );
  const lessonDock = {
    "data-tutorial-dock": moment,
    "data-tutorial-aspect": aspectId,
    "data-tutorial-layout": layout,
    "data-tutorial-status": status,
    "data-tutorial-form": form,
  };

  if (form === "card")
    return (
      <EmissaryCard
        dockRef={dock}
        aspectId={aspectId}
        layout={layout}
        label={title}
        title={
          <>
            {phone && completed && <span className="emissary-dock__tick">✓</span>}
            {shownTitle}
          </>
        }
        controls={
          phone ? (
            !completed && (
              <>
                {skip}
                {!askingSkip && <EmissaryOk onClose={onDismiss} />}
              </>
            )
          ) : (
            <>
              {done}
              {skip}
              {!askingSkip && <EmissaryOk onClose={onDismiss} />}
            </>
          )
        }
        className={completed ? "emissary-dock--completed" : undefined}
        attributes={lessonDock}
      >
        {phone ? (
          <>
            <span className="emissary-dock__line">{lessonLine}</span>
            {action}
          </>
        ) : (
          <p className="emissary-dock__speech">
            <span>{lessonLine}</span>
            {action}
          </p>
        )}
      </EmissaryCard>
    );

  return (
    <aside
      ref={dock}
      {...lessonDock}
      aria-label={`${emissary.name}: ${title}`}
      className={`emissary-dock emissary-dock--${form} pointer-events-auto${phone ? " emissary-dock--phone" : ""}${completed ? " emissary-dock--completed" : ""}`}
      style={emissary.style}
    >
      {form === "reminder" ? (
        <>
          <span className="emissary-dock__fold-portrait">{portrait(22)}</span>
          <span className="emissary-dock__fold-label">{OPENING_WORDS.tutorial}</span>
          <span className="emissary-dock__fold-title">{shownTitle}</span>
          <button
            type="button"
            className="emissary-dock__btn emissary-dock__fold-btn"
            aria-label={OPENING_WORDS.showLesson}
            onClick={() => setExpandedOver(framesOpen)}
          >
            ▾
          </button>
          <EmissaryOk onClose={onDismiss} />
        </>
      ) : (
        <>
          <span className="emissary-dock__fold-portrait">{portrait(32)}</span>
          <span className="emissary-dock__strip-text">
            <span className="emissary-dock__strip-title">{shownTitle}</span>
            <span className="emissary-dock__strip-line">
              {says("asks" in spec ? spec.asks.line(rules) : undefined)}
            </span>
          </span>
          <span className="emissary-dock__controls">
            {done}
            {skip}
          </span>
        </>
      )}
    </aside>
  );
}

export const EmissaryOk = ({ onClose }: { onClose: () => void }) => (
  <button type="button" className="emissary-dock__btn emissary-dock__ok" onClick={onClose}>
    {OK}
  </button>
);

export const EmissaryCard = ({
  aspectId,
  layout,
  label,
  title,
  controls,
  tone,
  picture,
  className,
  attributes,
  dockRef,
  children,
}: {
  aspectId: AspectId;
  picture?: IconMeaning;
  layout: "desktop" | "phone";
  label: string;
  title: ReactNode;
  controls?: ReactNode;
  tone?: "bane";
  className?: string;
  attributes?: Record<string, string | number | undefined>;
  dockRef?: Ref<HTMLElement>;
  children: ReactNode;
}) => {
  const emissary = resolveAspectEmissary(aspectId);
  const phone = layout === "phone";
  const portrait = (size: number) => (
    <Icon
      name={picture ?? emissary.portrait}
      size={size}
      alt={picture ? label : emissary.name}
      className="emissary-dock__portrait"
    />
  );
  const medallion = (size: number) => (
    <span className="emissary-dock__medallion">
      <AspectMark aspect={aspectId} size={size} decorative />
    </span>
  );
  return (
    <aside
      ref={dockRef}
      {...attributes}
      data-tone={tone}
      aria-label={`${emissary.name}: ${label}`}
      className={`emissary-dock emissary-dock--card pointer-events-auto${phone ? " emissary-dock--phone" : ""}${className ? ` ${className}` : ""}`}
      style={emissary.style}
    >
      {phone ? (
        <>
          <span className="emissary-dock__portrait-bay">
            <span className="emissary-dock__portrait-frame">{portrait(48)}</span>
            {medallion(16)}
          </span>
          <span className="emissary-dock__body">
            <span className="emissary-dock__head">
              <span className="emissary-dock__title">{title}</span>
              {controls && <span className="emissary-dock__controls">{controls}</span>}
            </span>
            {children}
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
            <div className="emissary-dock__portrait-frame">{portrait(68)}</div>
            {medallion(20)}
          </div>
          <div className="emissary-dock__body">
            <div className="emissary-dock__head">
              <span className="emissary-dock__speaker">
                <span className="emissary-dock__gem" aria-hidden="true" />
                <span className="emissary-dock__aspect">{emissary.name}</span>
                <span className="emissary-dock__title">· {title}</span>
              </span>
              {controls && <span className="emissary-dock__controls">{controls}</span>}
            </div>
            {children}
          </div>
        </>
      )}
    </aside>
  );
};

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
