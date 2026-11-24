import "./doorway-screen.css";

import { aspectName, type AspectId } from "@bibliothecadao/types";
import type { CSSProperties, ReactNode } from "react";

import { useMonotonicLoadingProgress } from "@/game-entry/loading-progress";
import { useLayout } from "@/shell/frame/layout";
import { gamePainting, modeLabel } from "@/shell/game-links";
import type { DirectoryGame } from "@/shell/herald";
import { aspectVariables } from "@/tokens";
import { AspectMark } from "@/ui/design-system/aspect-mark";
import { AGE_LOCKUP } from "@/ui/design-system/icon-meaning";
import { paintingSources, type Painting } from "@/ui/design-system/kit/paintings";
import { ASPECT_STEP_WORDS, DAY, DOORWAY_WORDS } from "@/ui/design-system/kit/words";

import type { DoorwayView } from "./doorway-view";
import { EntryProgress } from "./entry-progress";

export interface DoorwayRealm {
  name: string;
  emblem: { art: string; name: string } | null;
  aspect?: AspectId | null;
}

export type DoorwayGame = Pick<DirectoryGame, "mode"> &
  Partial<Pick<DirectoryGame, "day_index">> & { clock?: Pick<DirectoryGame["clock"], "start_main_at"> };

const DEFAULT_PAINTING: Painting = "frontier-mist";

const modeLockup = (mode: DoorwayGame["mode"] | undefined): { src: string; alt: string } => {
  if (mode === "blitz" || mode === "eternum") {
    return { src: AGE_LOCKUP[mode], alt: modeLabel({ mode }) };
  }
  return { src: AGE_LOCKUP.frontier, alt: modeLabel({ mode: "frontier" }) };
};

export const LoadingStage = ({
  view,
  realm = null,
  game,
  showTip = false,
  children,
}: {
  view?: DoorwayView;
  realm?: DoorwayRealm | null;
  game?: DoorwayGame;
  showTip?: boolean;
  children?: ReactNode;
}) => {
  const layout = useLayout();
  const desktop = layout === "desktop";
  const sharedPercent = useMonotonicLoadingProgress();
  const painting = game ? gamePainting(game) : DEFAULT_PAINTING;
  const lockup = modeLockup(game?.mode);
  const aspect = realm?.aspect ?? null;
  const day = game?.day_index != null ? game.day_index + 1 : null;
  const meta = buildStageMeta(aspect, day, desktop);
  const stageStyle = aspect !== null ? (aspectVariables(aspect) as CSSProperties) : undefined;
  return (
    <div data-surface="shell" data-layout={layout} data-doorway-loading style={stageStyle} className="doorway-stage">
      <img aria-hidden {...paintingSources(painting)} sizes="100vw" alt="" className="doorway-stage__painting" />
      <div aria-hidden className="doorway-stage__scrim" />
      <main data-band={view ? "body" : undefined} className="doorway-stage__center">
        <img src={lockup.src} alt={lockup.alt} className="doorway-stage__lockup" />
        {(aspect !== null || realm?.emblem) && (
          <div className="doorway-stage__facet">
            {aspect !== null ? (
              <AspectMark aspect={aspect} size={76} />
            ) : (
              realm?.emblem && <img src={realm.emblem.art} alt={realm.emblem.name} className="size-16 object-contain" />
            )}
          </div>
        )}
        {realm && (
          <div className="doorway-stage__identity">
            <h1 className="doorway-stage__heading">{DOORWAY_WORDS.enteringRealm(realm.name)}</h1>
            {meta && <p className="doorway-stage__meta">{meta}</p>}
          </div>
        )}
        {children}
      </main>
      <footer data-band={view ? "foot" : undefined} className="doorway-stage__foot">
        {view ? (
          <EntryProgress view={view} showTip={showTip} />
        ) : sharedPercent > 0 ? (
          <div
            role="progressbar"
            aria-label={DOORWAY_WORDS.entering}
            aria-valuenow={sharedPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            className="doorway-bar"
          >
            <div className="doorway-bar__fill" style={{ width: `${sharedPercent}%` }} />
          </div>
        ) : (
          <div className="doorway-bar" aria-hidden="true">
            <div className="doorway-bar__fill doorway-bar__fill--indeterminate" />
          </div>
        )}
      </footer>
    </div>
  );
};

const buildStageMeta = (aspect: AspectId | null, day: number | null, desktop: boolean): string | null => {
  const parts: string[] = [];
  if (aspect !== null) {
    parts.push(desktop ? ASPECT_STEP_WORDS.aspectOf(aspectName(aspect)) : aspectName(aspect));
  }
  if (day !== null) {
    parts.push(`${DAY} ${day}`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
};
