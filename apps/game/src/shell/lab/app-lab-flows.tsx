import { BLITZ_WORDS, LORE_LINE, SIGN_IN_WORDS, WORDS } from "@/ui/design-system/kit/words";
import type { ReactNode } from "react";
import { useParams } from "react-router-dom";

import { gamePainting } from "@/shell/game-links";
import { Pill } from "@/ui/design-system/kit/pill";
import { DoorwayScreen } from "@/ui/features/game-entry/doorway/doorway-screen";

import { AppPanel } from "@/ui/design-system/kit/app-elements";
import { ClockChip } from "@/ui/design-system/kit/clock-chip";

import { PageFrame } from "../frame/page-frame";
import { PlayPage } from "../play/play-page";
import { ConnectWindow } from "../sign-in/connect-window";
import { NotFoundPage } from "../not-found";
import { CodeStep } from "../sign-in/code-step";
import { ProfileStep } from "../sign-in/profile-step";
import { SignInFrame } from "../sign-in/sign-in-page";
import { StartStep } from "../sign-in/start-step";
import { useNowSeconds } from "../use-now";
import { LAB_DOORWAYS, LAB_NEW_ACCOUNTS, LAB_SIGN_IN_EMAIL, LAB_SEASON_WAIT, labCodeExpiry } from "./app-lab-fixtures";

const noop = () => undefined;

/** Sign-in's lab steps, by name: each step's title and its body over the fixtures; the real flow reaches the later
 * steps only through the identity service. */
const labSignInStep = (step: string | undefined): { title: string; body: ReactNode } | null => {
  switch (step) {
    case "start":
      return {
        title: WORDS.signIn,
        body: <StartStep sending={false} error={null} onDiscord={noop} onEmail={noop} />,
      };
    case "code":
      return {
        title: SIGN_IN_WORDS.codeSent,
        body: (
          <CodeStep
            email={LAB_SIGN_IN_EMAIL}
            expiresAt={labCodeExpiry()}
            checking={false}
            sending={false}
            error={null}
            onCode={async () => false}
            onNewCode={noop}
            onChangeEmail={noop}
            onTyping={noop}
          />
        ),
      };
    case "name":
    case "name-refused":
      return {
        title: SIGN_IN_WORDS.yourName,
        body: <ProfileStep session={LAB_NEW_ACCOUNTS[step]} onClaimed={noop} />,
      };
    default:
      return null;
  }
};

/**
 * Sign-in's steps one at a time, each in the flow's own frame (/lab/app/<screen>/sign-in/<step>): the start, the
 * emailed code, and a new account's name and portrait, with the suggested name passing the rule or refused.
 */
export const LabSignIn = () => {
  const { step } = useParams();
  const shown = labSignInStep(step);
  if (!shown) return <NotFoundPage />;
  return (
    <SignInFrame next="/" title={shown.title} hero={step === "start"}>
      {shown.body}
    </SignInFrame>
  );
};

/**
 * Connect's two options, each at every step (/lab/app/<screen>/connect/<option>/<step>): `window`, the steps in a
 * window over Play (a sheet from the foot on a phone); `you`, the steps on You itself.
 */
export const LabConnect = () => {
  const { option, step } = useParams();
  const shown = labSignInStep(step);
  if (!shown) return <NotFoundPage />;
  if (option === "window")
    return (
      <>
        <PlayPage />
        <ConnectWindow title={shown.title === WORDS.signIn ? WORDS.connect : shown.title} onClose={noop}>
          {shown.body}
        </ConnectWindow>
      </>
    );
  if (option === "you")
    return (
      <PageFrame title={WORDS.connect}>
        <div className="flex max-w-column flex-col gap-4">
          <AppPanel title={LORE_LINE} painting="winter-fortress">
            <div className="flex flex-col gap-4">
              {step !== "start" && <h2 className="text-app-title text-app-ink">{shown.title}</h2>}
              {shown.body}
            </div>
          </AppPanel>
        </div>
      </PageFrame>
    );
  return <NotFoundPage />;
};

/** The doorway into Frontier at one of its holds (/lab/app/<screen>/doorway/<state>), as entering a game draws it. */
export const LabDoorway = () => {
  const { state } = useParams();
  const now = useNowSeconds();
  const doorway = state && Object.hasOwn(LAB_DOORWAYS, state) ? LAB_DOORWAYS[state as keyof typeof LAB_DOORWAYS] : null;
  if (!doorway) return <NotFoundPage />;
  return (
    <DoorwayScreen
      view={doorway.view}
      realm={doorway.realm}
      title="Frontier"
      painting={gamePainting({ mode: "frontier" })}
      onRetry={noop}
      onOpenRealm={noop}
      onSignIn={noop}
      onSpectate={noop}
      results="/lab/app/reward-sealed/results/0x5245414c4d53-7"
    >
      {/* The entry's own chips at the realm step, as game-entry-modal passes them. */}
      {state === "waiting" && <ClockChip prefix="starts" at={now + LAB_SEASON_WAIT} now={now} />}
      {state === "preparing" && <Pill icon="check">{`${BLITZ_WORDS.preparing} 17/24`}</Pill>}
    </DoorwayScreen>
  );
};
