import { BLITZ_WORDS, SIGN_IN_WORDS, WORDS } from "@/ui/design-system/kit/words";
import type { ReactNode } from "react";
import { useParams } from "react-router-dom";

import { gamePainting } from "@/shell/game-links";
import { Pill } from "@/ui/design-system/kit/pill";
import { DoorwayScreen } from "@/ui/features/game-entry/doorway/doorway-screen";

import { ClockChip } from "@/ui/design-system/kit/clock-chip";

import { PlayPage } from "../play/play-page";
import { PageAddress } from "../frame/page-address";
import { ConnectWindow } from "../sign-in/connect-window";
import { HandoffStep } from "../sign-in/handoff-step";
import { NotFoundPage } from "../not-found";
import { CodeStep } from "../sign-in/code-step";
import { ProfileStep } from "../sign-in/profile-step";
import { StartStep } from "../sign-in/start-step";
import { useNowSeconds } from "../use-now";
import { LAB_DOORWAYS, LAB_NEW_ACCOUNTS, LAB_SIGN_IN_EMAIL, LAB_SEASON_WAIT, labCodeExpiry } from "./app-lab-fixtures";

const noop = () => undefined;

/** Connect's steps over the fixtures, by name: each step's title and its body; the real flow reaches the later steps
 * only through the identity service. */
const labConnectStep = (step: string | undefined): { title: string; body: ReactNode } | null => {
  switch (step) {
    case "start":
      return {
        title: WORDS.connect,
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
    case "discord":
      return {
        title: SIGN_IN_WORDS.discord,
        body: <HandoffStep checking={false} error={null} onCode={async () => false} onDiscord={noop} onTyping={noop} />,
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
 * Connect's steps one at a time (/lab/app/<screen>/connect/<step>), each in the window over the screen's Play: the
 * start, the emailed code, the code a Discord sign-in finished in another browser shows, and a new account's name and
 * portrait, with the suggested name passing the rule or refused.
 */
export const LabConnect = () => {
  const { step } = useParams();
  const shown = labConnectStep(step);
  if (!shown) return <NotFoundPage />;
  // Play is at its own address under the window, so its place is lit as in the app.
  return (
    <PageAddress.Provider value="/">
      <PlayPage />
      <ConnectWindow title={shown.title} onClose={noop}>
        {shown.body}
      </ConnectWindow>
    </PageAddress.Provider>
  );
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
