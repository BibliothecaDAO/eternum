import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { useLayout } from "@/shell/frame/layout";
import { PageFrame } from "@/shell/frame/page-frame";
import { gamePainting } from "@/shell/game-links";
import { DEVICES_PATH } from "@/shell/profile/settings-route";
import { useNowSeconds } from "@/shell/use-now";
import { AspectMark } from "@/ui/design-system/aspect-mark";
import { AppButton, AppNotice, AppPanel } from "@/ui/design-system/kit/app-elements";
import { AppClockChip } from "@/ui/design-system/kit/clock-chip";
import { DOORWAY_WORDS, TRY_AGAIN, WORDS } from "@/ui/design-system/kit/words";

import type { DoorwayView } from "./doorway-view";
import { LoadingStage, type DoorwayGame, type DoorwayRealm } from "./loading-stage";

export type { DoorwayRealm };

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

  if (!asking && view.blocker === null && view.spectating === null) {
    return (
      <LoadingStage view={view} realm={realm} game={game}>
        {children}
      </LoadingStage>
    );
  }

  const hold = (
    <Hold view={view} game={game} onRetry={onRetry} onOpenRealm={onOpenRealm} onSignIn={onSignIn} results={results} />
  );
  return (
    <div data-surface="shell" className="fixed inset-0 z-50 overflow-y-auto bg-app-ground">
      <PageFrame painting={game ? gamePainting(game) : undefined} stage foot={desktop ? undefined : verb}>
        {desktop ? (
          <div
            className={`flex min-h-[calc(100dvh-var(--app-bar)-3rem)] justify-center py-2 ${wide ? "items-start" : "items-center"}`}
          >
            <AppPanel className={wide ? "w-full" : "w-column"}>
              <div className="flex flex-col items-stretch gap-5">
                {realm && <RealmRising realm={realm} />}
                {hold}
                {children}
                {verb}
              </div>
            </AppPanel>
          </div>
        ) : (
          <div
            className={`mx-auto flex min-h-full w-full max-w-doorway flex-col items-center gap-5 py-4 ${wide ? "justify-start" : "justify-center"}`}
          >
            {realm && <RealmRising realm={realm} />}
            {hold}
            {children}
          </div>
        )}
      </PageFrame>
    </div>
  );
};

export const RealmRising = ({ realm }: { realm: DoorwayRealm }) => (
  <div data-realm-rising className="flex flex-col items-center gap-3">
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
  game,
  onRetry,
  onOpenRealm,
  onSignIn,
  results,
}: {
  view: DoorwayView;
  game?: DoorwayGame;
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
    case "waiting":
      return <WaitingHold startsAt={game?.clock?.start_main_at} />;
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

const WaitingHold = ({ startsAt }: { startsAt?: number }) => {
  const now = useNowSeconds();
  return (
    <div className="flex w-full flex-col items-stretch gap-3">
      <AppNotice line={DOORWAY_WORDS.notStarted} />
      {startsAt != null && startsAt > 0 && (
        <div className="flex justify-center">
          <AppClockChip prefix="starts" at={startsAt} now={now} />
        </div>
      )}
      <AppButton kind="primary" size="lg" icon="play" step to="/">
        {DOORWAY_WORDS.backToPlay}
      </AppButton>
    </div>
  );
};
