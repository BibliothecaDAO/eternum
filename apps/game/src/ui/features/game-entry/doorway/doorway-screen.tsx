import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { PageFrame } from "@/shell/frame/page-frame";
import { DOORWAY_WORDS, WORDS } from "@/shell/words";
import { Button } from "@/ui/design-system/kit/button";
import { ReasonPlate } from "@/ui/design-system/kit/reason-plate";
import { TRY_AGAIN } from "@/ui/design-system/kit/words";
import { useFrontierType } from "@/ui/features/frontier/use-frontier-type";

import type { DoorwayView } from "./doorway-view";
import { StepTrack } from "./step-track";

/** The realm coming through the doorway, as much of it as is known yet. */
export interface DoorwayRealm {
  name: string;
  emblem: { art: string; name: string } | null;
  /** The still for its castle level, once the level is known. */
  still: string | null;
}

/**
 * The doorway (spec 07): the realm rising under its Order's emblem, and the steps (account → realm → map → play)
 * continuing by themselves, on the app's frame with Back to the app on every step. It holds only for the one thing the
 * player must do, whose words come from their owners: sign in, try again, Devices, Watch or Results.
 */
export const DoorwayScreen = ({
  view,
  realm,
  title,
  onRetry,
  onSignIn,
  onSpectate,
  children,
}: {
  view: DoorwayView;
  realm: DoorwayRealm | null;
  /** The mode being entered, beside Back, once it is known. */
  title?: string;
  onRetry: () => void;
  onSignIn: () => void;
  onSpectate?: () => void;
  /** A mode's own control at the realm step, kept inside the doorway's frame. */
  children?: ReactNode;
}) => {
  useFrontierType();
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-kit-ground">
      <PageFrame back="/" title={title} tabs={false}>
        <div className="mx-auto flex w-full max-w-[640px] flex-col items-center gap-6 py-6">
          {realm ? <RealmRising realm={realm} /> : <div className="h-48" aria-hidden />}
          <StepTrack steps={view.steps} />
          <Hold view={view} onRetry={onRetry} onSignIn={onSignIn} onSpectate={onSpectate} />
          {children}
        </div>
      </PageFrame>
    </div>
  );
};

/** The realm: its emblem above, its castle on its board, its name. The still fades in as it rises. */
const RealmRising = ({ realm }: { realm: DoorwayRealm }) => (
  <div className="flex flex-col items-center gap-3">
    {realm.emblem && <img src={realm.emblem.art} alt={realm.emblem.name} className="size-12 object-contain" />}
    {realm.still ? (
      <img
        src={realm.still}
        alt=""
        className="h-44 w-60 animate-[doorway-rise_900ms_ease-out_both] object-cover [mask-image:radial-gradient(ellipse_at_center,black_45%,transparent_72%)]"
      />
    ) : (
      <div className="h-44" aria-hidden />
    )}
    <h2 className="text-center font-ui text-[26px] font-extrabold text-kit-cream">{realm.name}</h2>
  </div>
);

/** What holds the doorway, as one plate: its line and the one step the player can take. */
const Hold = ({
  view,
  onRetry,
  onSignIn,
  onSpectate,
}: {
  view: DoorwayView;
  onRetry: () => void;
  onSignIn: () => void;
  onSpectate?: () => void;
}) => {
  const navigate = useNavigate();
  const plate = (line: string, step: ReactNode) => (
    <div className="w-full">
      <ReasonPlate reason={{ kind: "failed", line }} step={step} />
    </div>
  );
  switch (view.blocker?.kind) {
    case "sign-in":
      return plate(
        DOORWAY_WORDS.signInToPlay,
        <Button role="primary" word={WORDS.signIn} icon="Pf" onClick={onSignIn} />,
      );
    case "retry":
      return plate(view.blocker.line, <Button role="outline" word={TRY_AGAIN} icon="Sp" onClick={onRetry} />);
    case "devices":
      return plate(
        DOORWAY_WORDS.deviceLimit,
        <Button role="primary" word={DOORWAY_WORDS.devices} icon="Dv" onClick={() => navigate("/profile")} />,
      );
  }
  if (!view.spectating || !onSpectate) return null;
  return view.spectating === "watch"
    ? plate(DOORWAY_WORDS.notOnThisGame, <Button role="secondary" word={WORDS.watch} icon="Wc" onClick={onSpectate} />)
    : plate(DOORWAY_WORDS.ended, <Button role="secondary" word={WORDS.results} icon="Tp" onClick={onSpectate} />);
};
