import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { useLayout } from "@/shell/frame/layout";
import { PageFrame } from "@/shell/frame/page-frame";
import { StepVerb } from "@/shell/frame/step-verb";
import type { Painting } from "@/ui/design-system/kit/paintings";
import { DEVICES_PATH } from "@/shell/profile/settings-route";
import { Button } from "@/ui/design-system/kit/button";
import { ReasonPlate } from "@/ui/design-system/kit/reason-plate";
import { TRY_AGAIN, DOORWAY_WORDS, WORDS } from "@/ui/design-system/kit/words";
import { Title } from "@/ui/design-system/kit/title";

import type { DoorwayView } from "./doorway-view";
import { StepTrack } from "./step-track";

/** The realm coming through the doorway, as much of it as is known yet. */
export interface DoorwayRealm {
  name: string;
  emblem: { art: string; name: string } | null;
}

/**
 * The doorway (spec 07): the realm rising under its Order's emblem, and the steps (account → realm → map → play)
 * continuing by themselves, on the app's frame with Back to the app on every step; on desktop one plate over the
 * mode's painting. It holds only for the one thing the
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
    <div data-surface="shell" className="fixed inset-0 z-50 overflow-y-auto bg-kit-ground">
      <PageFrame back="/" title={title} tabs={false} painting={painting} stage>
        {desktop ? (
          <div className="flex min-h-[calc(100vh-12rem)] items-center justify-center">
            <div className="plate flex w-column flex-col items-stretch gap-5 p-6">
              {realm && <RealmRising realm={realm} />}
              <StepTrack steps={view.steps} />
              {hold}
              {children}
            </div>
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-doorway flex-col items-center gap-6 py-6">
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
    <Title level="headline" face="body" as="h2" className="text-center font-extrabold">
      {realm.name}
    </Title>
  </div>
);

/** What holds the doorway, as one plate: its line and the one step the player can take. */
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
  const desktop = useLayout() === "desktop";
  // A phone sets the step beside its line; the desktop stacks them, the step full width on Enter.
  // A second way on (Try again beside Open realm) stands over the step on desktop and before it on a phone.
  const plate = (line: string, step: ReactNode, other?: ReactNode) =>
    desktop ? (
      <div className="flex w-full flex-col gap-3">
        <ReasonPlate reason={{ kind: "failed", line }} />
        {other}
        <StepVerb>{step}</StepVerb>
      </div>
    ) : (
      <div className="w-full">
        <ReasonPlate
          reason={{ kind: "failed", line }}
          step={
            <>
              {other}
              {step}
            </>
          }
        />
      </div>
    );
  switch (view.blocker?.kind) {
    case "sign-in":
      return plate(
        DOORWAY_WORDS.signInToPlay,
        <Button role="primary" word={WORDS.signIn} icon="person" onClick={onSignIn} />,
      );
    case "retry": {
      const retry = <Button role="outline" word={TRY_AGAIN} icon="refresh" onClick={onRetry} />;
      return view.blocker.openRealm && onOpenRealm
        ? plate(
            view.blocker.line,
            <Button role="primary" word={DOORWAY_WORDS.openRealm} icon="realm" onClick={onOpenRealm} />,
            retry,
          )
        : plate(view.blocker.line, retry);
    }
    case "devices":
      return (
        <div className="flex w-full flex-col gap-3">
          <ReasonPlate reason={{ kind: "failed", line: DOORWAY_WORDS.deviceLimit }} />
          <p className="text-sm text-kit-cream">{DOORWAY_WORDS.deviceLimitRecovery}</p>
          <a href={DEVICES_PATH} target="_blank" rel="noopener noreferrer" className="text-kit-gold underline">
            Settings → Devices
          </a>
          <Button role="primary" word={TRY_AGAIN} icon="refresh" onClick={onRetry} />
        </div>
      );
  }
  if (view.spectating === "watch" && onSpectate)
    return plate(
      DOORWAY_WORDS.notOnThisGame,
      <Button role="secondary" word={WORDS.watch} icon="watch" onClick={onSpectate} />,
    );
  if (view.spectating === "results" && results)
    return plate(
      DOORWAY_WORDS.ended,
      <Button role="secondary" word={WORDS.results} icon="victory" onClick={() => navigate(results)} />,
    );
  return null;
};
