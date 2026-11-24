import "./aspect-emissary-dock.css";

import { AspectMark } from "@/ui/design-system/aspect-mark";
import { Icon } from "@/ui/design-system/icon";
import { CLOSE, OPENING_WORDS, type OpeningRules } from "@/ui/design-system/kit/words";
import { OPENING, teacherAspectOf, type OpeningMoment } from "../opening/opening";
import type { TutorialDisplayStatus } from "../opening/opening-state";
import { resolveAspectEmissary } from "./aspect-emissaries";

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
  if (aspectId === null) return null;
  const emissary = resolveAspectEmissary(aspectId);
  const phone = layout === "phone";
  const completed = status === "completed";
  const title = OPENING_WORDS.titles[moment];
  const line = completed ? OPENING_WORDS.completed[moment] : OPENING_WORDS.lines[moment](rules);
  const action = OPENING_WORDS.actions[moment];

  return (
    <aside
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

      <div className="emissary-dock__emblem-bay">
        <div className="emissary-dock__emblem-socket">
          <AspectMark aspect={aspectId} size={phone ? 34 : 44} decorative />
        </div>
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
          {!phone && !completed && (
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
