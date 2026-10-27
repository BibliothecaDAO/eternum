import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { useLayout } from "@/shell/frame/layout";
import { PageFrame } from "@/shell/frame/page-frame";
import type { Painting } from "@/ui/design-system/kit/paintings";
import { DEVICES_PATH } from "@/shell/profile/settings-route";
import { AppButton, AppNotice, AppPanel } from "@/ui/design-system/kit/app-elements";
import { TRY_AGAIN, DOORWAY_WORDS, WORDS } from "@/ui/design-system/kit/words";

import type { DoorwayView } from "./doorway-view";
import { StepTrack } from "./step-track";

/** The realm coming through the doorway, as much of it as is known yet. */
export interface DoorwayRealm {
  name: string;
  emblem: { art: string; name: string } | null;
}

/**
 * The doorway (spec 07): the realm rising under its Order's emblem, and the steps (account → realm → map → play)
 * continuing by themselves, on the app's frame with Back to the app on every step, over the mode's painting: on desktop
 * one plate, on a phone the steps in the middle of the screen. It holds only for the one thing the
 * player must do, whose words come from their owners: sign in, try again, Devices, Watch or Results.
 */
export const DoorwayScreen = ({
  view,
  realm,
  title,
  painting,
  onRetry,
  onOpenRealm,
  onSignIn,
  onSpectate,
  results,
  children,
}: {
  view: DoorwayView;
  realm: DoorwayRealm | null;
  /** The mode being entered, beside Back, once it is known. */
  title?: string;
  /** The mode's painting behind the desktop's doorway, once the mode is known. */
  painting?: Painting;
  onRetry: () => void;
  /** Opens the realm view without the map, when the map could not be drawn. */
  onOpenRealm?: () => void;
  onSignIn: () => void;
  onSpectate?: () => void;
  /** The finished game's Results page, where an ended game's doorway leads. */
  results?: string;
  /** A mode's own control at the realm step, kept inside the doorway's frame. */
  children?: ReactNode;
}) => {
  const desktop = useLayout() === "desktop";
  const hold = (
    <Hold
      view={view}
      onRetry={onRetry}
      onOpenRealm={onOpenRealm}
      onSignIn={onSignIn}
      onSpectate={onSpectate}
      results={results}
    />
  );
  return (
    // The shell's surface from the window's edge, so the ground behind the frame is the shell's too.
    <div data-surface="shell" className="fixed inset-0 z-50 overflow-y-auto bg-app-ground">
      <PageFrame back="/" title={title} tabs={false} painting={painting} stage>
        {desktop ? (
          <div className="flex min-h-[calc(100vh-12rem)] items-center justify-center">
            <AppPanel className="w-column">
              <div className="flex flex-col items-stretch gap-5">
                {realm && <RealmRising realm={realm} />}
                <StepTrack steps={view.steps} />
                {hold}
                {children}
              </div>
            </AppPanel>
          </div>
        ) : (
          <div className="mx-auto flex min-h-[calc(100dvh-5rem)] w-full max-w-doorway flex-col items-center justify-center gap-6 py-6">
            {realm && <RealmRising realm={realm} />}
            <StepTrack steps={view.steps} />
            {hold}
            {children}
          </div>
        )}
      </PageFrame>
    </div>
  );
};

/** The realm: its Order's emblem above its name. */
const RealmRising = ({ realm }: { realm: DoorwayRealm }) => (
  <div className="flex flex-col items-center gap-3">
    {realm.emblem && <img src={realm.emblem.art} alt={realm.emblem.name} className="size-12 object-contain" />}
    <h2 className="text-center text-app-heading text-app-ink">{realm.name}</h2>
  </div>
);

/**
 * What holds the doorway: its line as the app's notice, then the one step the player can take (on Enter on a desktop);
 * a second way on (Try again beside Open realm) stands over it.
 */
const Hold = ({
  view,
  onRetry,
  onOpenRealm,
  onSignIn,
  onSpectate,
  results,
}: {
  view: DoorwayView;
  onRetry: () => void;
  onOpenRealm?: () => void;
  onSignIn: () => void;
  onSpectate?: () => void;
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
  if (view.spectating === "watch" && onSpectate)
    return hold(
      <AppNotice line={DOORWAY_WORDS.notOnThisGame} />,
      <AppButton kind="primary" size="lg" icon="watch" step onClick={onSpectate}>
        {WORDS.watch}
      </AppButton>,
    );
  if (view.spectating === "results" && results)
    return hold(
      <AppNotice line={DOORWAY_WORDS.ended} />,
      <AppButton kind="primary" size="lg" icon="victory" step onClick={() => navigate(results)}>
        {WORDS.results}
      </AppButton>,
    );
  return null;
};
