import type { ReactNode } from "react";

import { Check, Eye } from "@/ui/design-system/atoms/game-icons";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { CastleGlyph, MapGlyph, PersonGlyph, PlayGlyph } from "@/ui/features/frontier/glyphs";
import { useFrontierType } from "@/ui/features/frontier/use-frontier-type";

import type { DoorwayStep, DoorwayView } from "./doorway-view";

/** The realm coming through the doorway, as much of it as is known yet. */
export interface DoorwayRealm {
  name: string;
  emblem: { art: string; name: string } | null;
  /** The still for its castle level, once the level is known. */
  still: string | null;
}

const STEP_GLYPH: Record<DoorwayStep, (props: { className?: string }) => ReactNode> = {
  account: PersonGlyph,
  realm: CastleGlyph,
  map: MapGlyph,
  play: PlayGlyph,
};

const STEP_LABEL: Record<DoorwayStep, string> = { account: "Account", realm: "Realm", map: "World map", play: "Play" };

/**
 * The doorway (design o5): the realm under its Order's emblem, and the track (account → realm → map → play) filling on
 * its own. It draws a view of the entry's machines and waits on nothing itself; it holds only for the one thing the
 * player must do, a sign-in or a retry.
 */
export const DoorwayScreen = ({
  view,
  realm,
  onRetry,
  onSignIn,
  onSpectate,
  children,
}: {
  view: DoorwayView;
  realm: DoorwayRealm | null;
  onRetry: () => void;
  onSignIn: () => void;
  onSpectate?: () => void;
  /** An operator's or a mode's own control at the realm step, kept inside the doorway's frame. */
  children?: ReactNode;
}) => {
  useFrontierType();
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-y-auto bg-[#0c0a08] px-4 py-10 font-sans text-[#eadfc8]">
      <Rays />
      <div className="relative flex w-full max-w-sm flex-col items-center gap-6">
        {realm ? <RealmRising realm={realm} /> : <div className="h-48" aria-hidden />}
        <Track view={view} />
        {view.blocker ? (
          <Blocker blocker={view.blocker} onRetry={onRetry} onSignIn={onSignIn} />
        ) : view.offersSpectating && onSpectate ? (
          <button
            type="button"
            onClick={onSpectate}
            className="frontier-primary flex w-full items-center justify-center gap-2"
          >
            <Eye className="size-7" />
            Watch
          </button>
        ) : null}
        {children}
      </div>
    </div>
  );
};

/** The gold light behind the realm. */
const Rays = () => (
  <div
    aria-hidden
    className="pointer-events-none absolute inset-0 bg-[repeating-conic-gradient(from_0deg_at_50%_32%,rgba(246,172,29,0.07)_0deg_6deg,transparent_6deg_18deg)] [mask-image:radial-gradient(circle_at_50%_32%,black,transparent_70%)]"
  />
);

/** The realm: its emblem glowing above, its castle on its board, its name. The still fades in as it rises. */
const RealmRising = ({ realm }: { realm: DoorwayRealm }) => (
  <div className="flex flex-col items-center gap-3">
    {realm.emblem && (
      <img
        src={realm.emblem.art}
        alt={realm.emblem.name}
        className="size-12 object-contain drop-shadow-[0_0_14px_rgba(246,172,29,0.8)]"
      />
    )}
    {realm.still ? (
      <img
        src={realm.still}
        alt=""
        className="h-44 w-60 animate-[doorway-rise_900ms_ease-out_both] object-cover [mask-image:radial-gradient(ellipse_at_center,black_45%,transparent_72%)]"
      />
    ) : (
      <div className="h-44" aria-hidden />
    )}
    <h1 className="frontier-hero text-center font-[Lexend] font-extrabold">{realm.name}</h1>
  </div>
);

/** The four steps as glyphs joined by lines, and a bar filling with them. */
const Track = ({ view }: { view: DoorwayView }) => {
  const done = view.steps.filter((step) => step.state === "done").length;
  const running = view.steps.some((step) => step.state === "running") ? 0.5 : 0;
  return (
    <div className="flex w-full flex-col gap-5">
      <ol aria-label="Entering the game" className="flex items-center justify-center">
        {view.steps.map(({ step, state }, index) => {
          const Glyph = STEP_GLYPH[step];
          return (
            <li key={step} className="flex items-center">
              {index > 0 && (
                <span
                  aria-hidden
                  className={cn("h-1 w-8 sm:w-12", state === "waiting" ? "bg-[#2a2013]" : "bg-[#9fd06a]")}
                />
              )}
              <span
                aria-label={`${STEP_LABEL[step]}, ${state}`}
                aria-current={state === "running" ? "step" : undefined}
                className={cn(
                  "relative flex size-14 items-center justify-center rounded-full border-4 bg-[#15100a]",
                  state === "done" && "border-[#9fd06a]",
                  state === "running" && "border-[#f6ac1d] shadow-[0_0_18px_rgba(246,172,29,0.6)]",
                  state === "waiting" && "border-[#2a2013] opacity-50",
                )}
              >
                <Glyph className="size-7" />
                {state === "done" && (
                  <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-[#9fd06a]">
                    <Check className="size-3.5" />
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
      <div aria-hidden className="h-2.5 overflow-hidden rounded-full bg-[#2a2013]">
        <div
          className="h-full rounded-full bg-[#f6ac1d] shadow-[0_0_10px_rgba(246,172,29,0.7)] transition-[width] duration-700"
          style={{ width: `${((done + running) / view.steps.length) * 100}%` }}
        />
      </div>
    </div>
  );
};

/** The one thing the player must do: sign in, or try again after a failure. The detail is in the console. */
const Blocker = ({
  blocker,
  onRetry,
  onSignIn,
}: {
  blocker: NonNullable<DoorwayView["blocker"]>;
  onRetry: () => void;
  onSignIn: () => void;
}) => (
  <div role="alert" className="frontier-card flex w-full flex-col items-center gap-4 p-5 text-center">
    <p className="text-[17px] text-[#eadfc8]">{blocker.sentence}</p>
    <button
      type="button"
      onClick={blocker.action === "sign-in" ? onSignIn : onRetry}
      className="frontier-primary w-full"
    >
      {blocker.action === "sign-in" ? "Sign in" : "Retry"}
    </button>
  </div>
);
