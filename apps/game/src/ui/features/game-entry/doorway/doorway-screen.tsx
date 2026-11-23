import "./doorway-screen.css";

import { aspectName, type AspectId } from "@bibliothecadao/types";
import type { CSSProperties, ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { useLayout } from "@/shell/frame/layout";
import { PageFrame } from "@/shell/frame/page-frame";
import { gamePainting, modeLabel } from "@/shell/game-links";
import type { DirectoryGame } from "@/shell/herald";
import { DEVICES_PATH } from "@/shell/profile/settings-route";
import { aspectVariables } from "@/tokens";
import { AspectMark } from "@/ui/design-system/aspect-mark";
import { AGE_LOCKUP, REALMS_MARK } from "@/ui/design-system/icon-meaning";
import { AppButton, AppNotice, AppPanel } from "@/ui/design-system/kit/app-elements";
import { paintingSources, type Painting } from "@/ui/design-system/kit/paintings";
import { DAY, DOORWAY_WORDS, TRY_AGAIN, WORDS } from "@/ui/design-system/kit/words";

import type { DoorwayView } from "./doorway-view";
import { EntryProgress } from "./entry-progress";

export interface DoorwayRealm {
  name: string;
  emblem: { art: string; name: string } | null;
  aspect?: AspectId | null;
}

type DoorwayGame = Pick<DirectoryGame, "mode"> & Partial<Pick<DirectoryGame, "day_index">>;

const DEFAULT_PAINTING: Painting = "frontier-mist";

const modeLockup = (mode: DoorwayGame["mode"] | undefined): { src: string; alt: string } => {
  if (mode === "frontier" || mode === "blitz" || mode === "eternum") {
    return { src: AGE_LOCKUP[mode], alt: modeLabel({ mode }) };
  }
  return { src: REALMS_MARK.lettered, alt: "Realms" };
};

export const DoorwayScreen = ({
  view,
  realm,
  game,
  onRetry,
  onOpenRealm,
  onSignIn,
  results,
  asking = false,
  wide = false,
  verb,
  children,
}: {
  view: DoorwayView;
  realm: DoorwayRealm | null;
  game?: DoorwayGame;
  onRetry: () => void;
  onOpenRealm?: () => void;
  onSignIn: () => void;
  results?: string;
  asking?: boolean;
  wide?: boolean;
  verb?: ReactNode;
  children?: ReactNode;
}) => {
  const layout = useLayout();
  const desktop = layout === "desktop";
  const player = view.steps.some(({ step }) => step === "account");
  const loadingMap = view.steps.some(({ step, state }) => (step === "map" || step === "play") && state === "running");
  const tip =
    game?.mode === "frontier" && player && loadingMap && view.blocker === null
      ? realm !== null
        ? "deep"
        : "first"
      : null;

  if (!asking && view.blocker === null && view.spectating === null) {
    return (
      <LoadingStage layout={layout} view={view} realm={realm} game={game} tip={tip}>
        {children}
      </LoadingStage>
    );
  }

  const progress = !asking && <EntryProgress view={view} tip={tip} />;
  const hold = <Hold view={view} onRetry={onRetry} onOpenRealm={onOpenRealm} onSignIn={onSignIn} results={results} />;
  return (
    <div data-surface="shell" className="fixed inset-0 z-50 overflow-y-auto bg-app-ground">
      <PageFrame
        title={game ? modeLabel(game) : undefined}
        painting={game ? gamePainting(game) : undefined}
        stage
        foot={desktop ? undefined : verb}
      >
        {desktop ? (
          <div className="flex min-h-[calc(100dvh-7.5rem)] items-center justify-center">
            <AppPanel className={wide ? "w-full" : "w-column"}>
              <div className="flex flex-col items-stretch gap-5">
                {realm && <RealmRising realm={realm} />}
                {progress}
                {hold}
                {children}
                {verb}
              </div>
            </AppPanel>
          </div>
        ) : (
          <div className="mx-auto flex min-h-full w-full max-w-doorway flex-col items-center justify-center gap-5 py-4">
            {realm && <RealmRising realm={realm} />}
            {progress}
            {hold}
            {children}
          </div>
        )}
      </PageFrame>
    </div>
  );
};

const LoadingStage = ({
  layout,
  view,
  realm,
  game,
  tip,
  children,
}: {
  layout: "phone" | "desktop";
  view: DoorwayView;
  realm: DoorwayRealm | null;
  game?: DoorwayGame;
  tip: "first" | "deep" | null;
  children?: ReactNode;
}) => {
  const desktop = layout === "desktop";
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
      <main data-band="body" className="doorway-stage__center">
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
            <h1 className="doorway-stage__heading">{`Entering ${realm.name}`}</h1>
            {meta && <p className="doorway-stage__meta">{meta}</p>}
          </div>
        )}
        {children}
      </main>
      <footer data-band="foot" className="doorway-stage__foot">
        <EntryProgress view={view} tip={tip} />
      </footer>
    </div>
  );
};

const buildStageMeta = (aspect: AspectId | null, day: number | null, desktop: boolean): string | null => {
  const parts: string[] = [];
  if (aspect !== null) {
    parts.push(desktop ? `Aspect of ${aspectName(aspect)}` : aspectName(aspect));
  }
  if (day !== null) {
    parts.push(`${DAY} ${day}`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
};

const RealmRising = ({ realm }: { realm: DoorwayRealm }) => (
  <div className="flex flex-col items-center gap-3">
    {realm.aspect != null ? (
      <AspectMark aspect={realm.aspect} size={56} />
    ) : (
      realm.emblem && <img src={realm.emblem.art} alt={realm.emblem.name} className="size-12 object-contain" />
    )}
    <h2 className="text-center text-app-heading text-app-ink">{realm.name}</h2>
  </div>
);

const Hold = ({
  view,
  onRetry,
  onOpenRealm,
  onSignIn,
  results,
}: {
  view: DoorwayView;
  onRetry: () => void;
  onOpenRealm?: () => void;
  onSignIn: () => void;
  results?: string;
}) => {
  const navigate = useNavigate();
  const hold = (notice: ReactNode, step: ReactNode, other?: ReactNode) => (
    <div className="flex w-full flex-col items-stretch gap-3">
      {notice}
      {other}
      {step}
    </div>
  );
  const retry = (kind: "primary" | "secondary") => (
    <AppButton kind={kind} size="lg" icon="refresh" step={kind === "primary"} onClick={onRetry}>
      {TRY_AGAIN}
    </AppButton>
  );
  switch (view.blocker?.kind) {
    case "sign-in":
      return hold(
        <AppNotice line={DOORWAY_WORDS.signInToPlay} />,
        <AppButton kind="primary" size="lg" icon="person" step onClick={onSignIn}>
          {WORDS.signIn}
        </AppButton>,
      );
    case "retry":
      return view.blocker.openRealm && onOpenRealm
        ? hold(
            <AppNotice tone="bad" line={view.blocker.line} />,
            <AppButton kind="primary" size="lg" icon="realm" step onClick={onOpenRealm}>
              {DOORWAY_WORDS.openRealm}
            </AppButton>,
            retry("secondary"),
          )
        : hold(<AppNotice tone="bad" line={view.blocker.line} />, retry("primary"));
    case "refused":
      return hold(<AppNotice tone="bad" line={view.blocker.line} />, null);
    case "devices":
      return hold(
        <AppNotice
          tone="bad"
          line={DOORWAY_WORDS.deviceLimit}
          actions={
            <a href={DEVICES_PATH} target="_blank" rel="noopener noreferrer" className="text-app-accent underline">
              {DOORWAY_WORDS.removeDevice}
            </a>
          }
        />,
        retry("primary"),
      );
  }
  if (view.spectating === "results" && results)
    return hold(
      <AppNotice line={DOORWAY_WORDS.ended} />,
      <AppButton kind="primary" size="lg" icon="victory" step onClick={() => navigate(results)}>
        {WORDS.results}
      </AppButton>,
    );
  return null;
};
