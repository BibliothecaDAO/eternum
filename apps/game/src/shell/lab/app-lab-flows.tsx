import { AspectPicker } from "@/ui/features/game-entry/aspect-picker";
import type { AspectId } from "@bibliothecadao/types";
import { BLITZ_WORDS, SIGN_IN_PROVIDER_NAMES, SIGN_IN_WORDS, WORDS } from "@/ui/design-system/kit/words";
import { failureSentence } from "@/ui/modules/identity/identity-failures";
import { IdentityRequestError, SOCIAL_PROVIDERS } from "@realms-world/identity";
import { useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";

import { useHeldRealms } from "@/hooks/use-holdings";
import { Pill } from "@/ui/design-system/kit/pill";
import { DoorwayScreen } from "@/ui/features/game-entry/doorway/doorway-screen";
import { FoundButton } from "@/ui/features/game-entry/game-entry-modal";
import { EntryModeSwitch, HomeSourcePicker } from "@/ui/features/game-entry/home-source-picker";
import { RealmSideWarning } from "@/ui/features/game-entry/realm-side-warning";
import { DayShareSheet } from "@/ui/features/frontier/rollover/day-share-sheet";

import { PlayPage } from "../play/play-page";
import { PageAddress } from "../frame/page-address";
import type { SharedDay } from "../share/day-card";
import { SignInStage } from "../sign-in/sign-in-stage";
import { HandoffStep } from "../sign-in/handoff-step";
import { NotFoundPage } from "../not-found";
import { CodeStep } from "../sign-in/code-step";
import { ProfileStep } from "../sign-in/profile-step";
import { StartStep } from "../sign-in/start-step";
import { useNowSeconds } from "../use-now";
import {
  LAB_CHAIN,
  LAB_DOORWAYS,
  LAB_INVITE,
  LAB_NEW_ACCOUNTS,
  LAB_PLAYER,
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
  const isStart = step === "start" || step === "start-refused" || step === "opening";
  return (
    <PageAddress.Provider value="/">
      <PlayPage />
      <SignInStage
        title={shown.title}
        heading={isStart ? SIGN_IN_WORDS.enterHeading : undefined}
        subtitle={isStart ? SIGN_IN_WORDS.enterSubtitle : undefined}
        onClose={noop}
      >
        {shown.body}
      </SignInStage>
    </PageAddress.Provider>
  );
};

/** The Frontier game the lab's doorway enters: the campaign's season, as the home step's picker reads it. */
const LAB_FRONTIER = { mode: "frontier", day_index: 5 } as const;

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
      game={state === "waiting" ? { ...LAB_FRONTIER, clock: { start_main_at: now + LAB_SEASON_WAIT } } : LAB_FRONTIER}
      onRetry={noop}
      onOpenRealm={noop}
      onSignIn={noop}
      results="/lab/app/season-over/results/0x5245414c4d53-3"
      asking={
        state === "home" ||
        state === "aspect" ||
        state === "aspect-realm" ||
        state === "aspect-kept" ||
        state === "realm-side"
      }
      wide={state === "home" || state === "aspect" || state === "aspect-realm" || state === "aspect-kept"}
      verb={undefined}
    >
      {/* The entry's own chips at the realm step, as game-entry-modal passes them. */}
      {state === "preparing" && <Pill icon="hourglass">{`${BLITZ_WORDS.preparing} 17/24`}</Pill>}
      {state === "home" && <LabHomeStep />}
      {state === "aspect" && <LabAspectStep />}
      {state === "aspect-realm" && (
        <AspectPicker
          members={LAB_ASPECT_MEMBERS}
          realmOrder={4}
          keptOrder={null}
          chosen={null}
          joining={null}
          offered={null}
          onChoose={noop}
          onFound={noop}
        />
      )}
      {state === "aspect-kept" && (
        <AspectPicker
          members={LAB_ASPECT_MEMBERS}
          realmOrder={null}
          keptOrder={LAB_INVITE.order}
          chosen={null}
          joining={null}
          offered={null}
          onChoose={noop}
          onFound={noop}
        />
      )}
      {state === "realm-side" && (
        <RealmSideWarning
          side={{ kind: "invited", offer: { aspect: LAB_INVITE.moment, sender: LAB_INVITE.name } }}
          realmId={LAB_HARMONY_REALM}
          onPlayRealm={noop}
          onJoinFree={noop}
        />
      )}
    </DoorwayScreen>
  );
};

const LabHomeStep = () => {
  const [value, setValue] = useState("");
  const [playingFree, setPlayingFree] = useState(false);
  const { held } = useHeldRealms();
  const heldCount = held.data?.length ?? 0;
  return (
    <>
      <EntryModeSwitch
        heldCount={heldCount}
        playingFree={playingFree}
        onChange={(mode) => setPlayingFree(mode === "free")}
      />
      {playingFree ? (
        <LabAspectStep />
      ) : (
        <HomeSourcePicker
          registered={null}
          value={value}
          onChange={setValue}
          onSettled={noop}
          disabled={false}
          action={<FoundButton founding={false} ready onFound={noop} />}
        />
      )}
    </>
  );
};

const LAB_SHARED_DAY: SharedDay = {
  player: LAB_PLAYER,
  game: { chainId: LAB_CHAIN, gameId: 1 },
  day: 6,
  totals: { reveals: 31, cleared: 6, essence: 420, labor: 1_200 },
  rank: { from: 5, to: 4 },
  trail: ["Ruin", "Rift", "Camp", "Beasts"],
  best: { kind: "clear", site: "Ruin", guard: 640, paid: { resource: "essence", amount: 420 } },
  realm: { name: "Temtinos", order: 5 },
};

export const LabDayShare = () => (
  <PageAddress.Provider value="/">
    <PlayPage />
    <div data-hud-mode="frontier">
      <DayShareSheet shared={LAB_SHARED_DAY} onClose={noop} />
    </div>
  </PageAddress.Provider>
);

const LAB_ASPECT_MEMBERS = { 1: 38, 2: 21, 3: 1, 4: 0 };
const LAB_HARMONY_REALM = 2;
const LabAspectStep = () => {
  const [chosen, setChosen] = useState<AspectId | null>(null);
  const [joining, setJoining] = useState<number | null>(null);
  return (
    <AspectPicker
      members={LAB_ASPECT_MEMBERS}
      realmOrder={null}
      keptOrder={null}
      chosen={chosen}
      joining={joining}
      offered={null}
      onChoose={setChosen}
      onFound={setJoining}
    />
  );
};
