import { BLITZ_WORDS, SIGN_IN_WORDS, WORDS } from "@/ui/design-system/kit/words";
import { useParams } from "react-router-dom";

import { gamePainting } from "@/shell/game-links";
import { Pill } from "@/ui/design-system/kit/pill";
import { DoorwayScreen } from "@/ui/features/game-entry/doorway/doorway-screen";

import { ClockChip } from "@/ui/design-system/kit/clock-chip";
import { NotFoundPage } from "../not-found";
import { CodeStep } from "../sign-in/code-step";
import { ProfileStep } from "../sign-in/profile-step";
import { SignInFrame } from "../sign-in/sign-in-page";
import { StartStep } from "../sign-in/start-step";
import { useNowSeconds } from "../use-now";
import { LAB_DOORWAYS, LAB_NEW_ACCOUNTS, LAB_SIGN_IN_EMAIL, LAB_SEASON_WAIT, labCodeExpiry } from "./app-lab-fixtures";

const noop = () => undefined;

/**
 * Sign-in's steps one at a time, each in the flow's own frame (/lab/app/<screen>/sign-in/<step>): the start, the
 * emailed code, and a new account's name and portrait, with the suggested name passing the rule or refused. The real
 * page reaches the later steps only through the identity service.
 */
export const LabSignIn = () => {
  const { step } = useParams();
  switch (step) {
    case "start":
      return (
        <SignInFrame next="/" title={WORDS.signIn} hero>
          <StartStep sending={false} error={null} onDiscord={noop} onEmail={noop} />
        </SignInFrame>
      );
    case "code":
      return (
        <SignInFrame next="/" title={SIGN_IN_WORDS.codeSent}>
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
        </SignInFrame>
      );
    case "name":
    case "name-refused":
      return (
        <SignInFrame next="/" title={SIGN_IN_WORDS.yourName}>
          <ProfileStep session={LAB_NEW_ACCOUNTS[step]} onClaimed={noop} />
        </SignInFrame>
      );
    default:
      return <NotFoundPage />;
  }
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
