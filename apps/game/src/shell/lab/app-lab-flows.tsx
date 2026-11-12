import { BLITZ_WORDS, SIGN_IN_PROVIDER_NAMES, SIGN_IN_WORDS, WORDS } from "@/ui/design-system/kit/words";
import { failureSentence } from "@/ui/modules/identity/identity-failures";
import { IdentityRequestError, SOCIAL_PROVIDERS } from "@realms-world/identity";
import { CAMPAIGNS } from "@realms-world/identity";
import { useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";

import { Pill } from "@/ui/design-system/kit/pill";
import { DoorwayScreen } from "@/ui/features/game-entry/doorway/doorway-screen";
import { FoundButton, PlaysAs } from "@/ui/features/game-entry/game-entry-modal";
import { HomeSourcePicker } from "@/ui/features/game-entry/home-source-picker";
import { AspectPicker } from "@/ui/features/game-entry/aspect-picker";
import { Aspect, ASPECT_ORDERS, Giver } from "@bibliothecadao/types";

import { ClockChip } from "@/ui/design-system/kit/clock-chip";

import { PlayPage } from "../play/play-page";
import { PageAddress } from "../frame/page-address";
import { ShellWindow } from "../frame/shell-window";
import { DEVCON } from "../join/devcon";
import { HandoffStep } from "../sign-in/handoff-step";
import { NotFoundPage } from "../not-found";
import { CodeStep } from "../sign-in/code-step";
import { ProfileStep } from "../sign-in/profile-step";
import { StartStep } from "../sign-in/start-step";
import { useNowSeconds } from "../use-now";
import {
  LAB_ASPECT_MEMBERS,
  LAB_DOORWAYS,
  LAB_NEW_ACCOUNTS,
  LAB_SIGN_IN_EMAIL,
  LAB_SEASON_WAIT,
  labCodeExpiry,
} from "./app-lab-fixtures";

const noop = () => undefined;

/** Connect's steps over the fixtures, by name: each step's title and its body; the real flow reaches the later steps
 * only through the identity service. */
const labConnectStep = (step: string | undefined): { title: string; body: ReactNode } | null => {
  switch (step) {
    case "start":
    case "start-refused":
    case "opening":
      return {
        title: WORDS.connect,
        body: (
          <StartStep
            sending={false}
            preparing={null}
            // A phone's tap handed Discord's sign-in to its app, which is coming up.
            opening={step === "opening" ? "discord" : null}
            // A provider refused: its email already has an account, which signs in with an email code.
            error={step === "start-refused" ? labRefusal("social", "account_not_linked") : null}
            providers={SOCIAL_PROVIDERS}
            onProvider={noop}
            onEmail={noop}
          />
        ),
      };
    case "code":
    case "code-refused":
      return {
        title: SIGN_IN_WORDS.codeSent,
        body: (
          <CodeStep
            email={LAB_SIGN_IN_EMAIL}
            expiresAt={labCodeExpiry()}
            checking={false}
            sending={false}
            // The service refused the code after too many tries with it.
            error={step === "code-refused" ? labRefusal("code", "TOO_MANY_ATTEMPTS") : null}
            onCode={async () => false}
            onNewCode={noop}
            onChangeEmail={noop}
            onTyping={noop}
          />
        ),
      };
    case "handoff":
      return {
        title: SIGN_IN_PROVIDER_NAMES.google,
        body: (
          <HandoffStep
            provider="google"
            checking={false}
            preparing={false}
            error={null}
            onCode={async () => false}
            onRetry={noop}
            onTyping={noop}
          />
        ),
      };
    case "name":
    case "name-refused":
    case "name-email":
      return {
        title: SIGN_IN_WORDS.yourName,
        body: <ProfileStep session={LAB_NEW_ACCOUNTS[step]} onClaimed={noop} />,
      };
    default:
      return null;
  }
};

/** A sign-in refusal as the player reads it: the identity service's code through the app's own sentence for it. */
const labRefusal = (action: "social" | "code", code: string) =>
  failureSentence(action, new IdentityRequestError(400, code));

/**
 * Connect's steps one at a time (/lab/app/<screen>/connect/<step>), each in the window over the screen's Play: the
 * start, the emailed code (each also refused: Discord's email has an account, the code was tried too often), the code a
 * Discord sign-in finished in another browser shows, and a new account's name and portrait, with the suggested name
 * passing the rule or refused.
 */
export const LabConnect = () => {
  const { step } = useParams();
  const shown = labConnectStep(step);
  if (!shown) return <NotFoundPage />;
  // Play is at its own address under the window, so its place is lit as in the app.
  return (
    <PageAddress.Provider value="/">
      <PlayPage />
      <ShellWindow title={shown.title} onClose={noop}>
        {shown.body}
      </ShellWindow>
    </PageAddress.Provider>
  );
};

/** The Frontier game the lab's doorway enters: the campaign's season, as the home step's picker reads it. */
const LAB_FRONTIER = { mode: "frontier", preset_id: CAMPAIGNS[DEVCON.campaign].presets[0] } as const;

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
      game={LAB_FRONTIER}
      onRetry={noop}
      onOpenRealm={noop}
      onSignIn={noop}
      onSpectate={noop}
      results="/lab/app/reward-sealed/results/0x5245414c4d53-7"
      asking={state === "home" || state === "aspect" || state === "aspect-realm"}
      verb={
        state === "home" || state === "aspect-realm" ? <FoundButton founding={false} ready onFound={noop} /> : undefined
      }
    >
      {/* The entry's own chips at the realm step, as game-entry-modal passes them. */}
      {state === "waiting" && <ClockChip prefix="starts" at={now + LAB_SEASON_WAIT} now={now} />}
      {state === "preparing" && <Pill icon="hourglass">{`${BLITZ_WORDS.preparing} 17/24`}</Pill>}
      {state === "home" && <LabHomeStep />}
      {state === "aspect" && <LabAspectStep />}
      {state === "aspect-realm" && (
        <AspectPicker
          members={LAB_ASPECT_MEMBERS}
          realmOrder={ASPECT_ORDERS[Aspect.Guile][Giver.Spoils]}
          joining={null}
          onJoin={noop}
        />
      )}
    </DoorwayScreen>
  );
};

/** The Devcon game's Realm step over the screen's holdings, as game-entry-modal draws it: the pick, its verb pinned. */
const LabHomeStep = () => {
  const [value, setValue] = useState("");
  return (
    <>
      <HomeSourcePicker
        presetId={LAB_FRONTIER.preset_id}
        registered={null}
        value={value}
        onChange={setValue}
        onSettled={noop}
        disabled={false}
      />
      <PlaysAs />
    </>
  );
};

/** A campaign home's Aspect step: a tap joins, and the card spins as founding would, until the lab resets it. */
const LabAspectStep = () => {
  const [joining, setJoining] = useState<Aspect | null>(null);
  return (
    <>
      <AspectPicker members={LAB_ASPECT_MEMBERS} realmOrder={null} joining={joining} onJoin={setJoining} />
      <PlaysAs />
    </>
  );
};
