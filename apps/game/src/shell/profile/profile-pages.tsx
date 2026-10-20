import { LORE_LINE, PROFILE_WORDS, SIGN_IN_WORDS, WORDS } from "@/ui/design-system/kit/words";
import { useEffect, useRef, type ReactNode } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { isAccountStatePrompt } from "@/hooks/context/gameplay-account-sync";
import { identityUsername, signOutIdentitySession, useIdentitySession } from "@/hooks/context/identity-session";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { AppButton, AppPanel, AppSetting, AppSwitch } from "@/ui/design-system/kit/app-elements";
import { forgetDeviceKey } from "@bibliothecadao/eternum";

import { setAppMusic, useAppMusic } from "../app-music";
import { backFrom } from "../frame/opened-from";
import { useLayout } from "../frame/layout";
import { PageFrame } from "../frame/page-frame";
import { useRealmsPlayer } from "../herald";
import { Loading } from "../loading";
import { NothingHere } from "../not-found";
import { useRequestSignIn } from "../sign-in/sign-in-route";
import { AccountCard, SignOut } from "./account-card";
import { DevicesCard } from "./devices-page";
import { NotificationsCard } from "./notifications";
import { PlayerCard, ProfileView, RecentGames } from "./profile-view";
import { SETTINGS_PATH } from "./settings-route";

/**
 * How to play: the Blitz guide's first page on the docs site (apps/game-docs), the rules a new player reads before a
 * game. The site's front page is about the Realms at large and teaches no game.
 */
export const HOW_TO_PLAY = "https://docs.realms.world/blitz/key-concepts";

/**
 * You (spec 10, the place): the player's page as others see it, their finished games, then two rows: Settings and How
 * to play (the Blitz guide on the docs site). Signed out, one card with Sign in above How to play; a device removed
 * elsewhere, one card with Sign in to add it back. What's new is a place of its own, beside Play and Season.
 */
export const ProfilePage = () => (
  <PageFrame title={useLayout() === "desktop" ? WORDS.you : undefined}>
    <SignedInOnly fallback={(card) => <SignedOut card={card} />}>
      {(account) => <OwnProfile account={account} />}
    </SignedInOnly>
  </PageFrame>
);

/** Signed out: the card that says why, then How to play. */
const SignedOut = ({ card }: { card: ReactNode }) => (
  <div className="flex max-w-column flex-col gap-4">
    {card}
    <AppPanel flush>
      <HowToPlayRow />
    </AppPanel>
  </div>
);

/**
 * Settings (spec 11, 12): every setting on one page, grouped: the account and its payout wallet, notifications, music
 * on this device, the account's devices, and Sign out last. The desktop sets them in two columns.
 */
export const SettingsPage = () => (
  <PageFrame back="/profile" title={PROFILE_WORDS.settings}>
    <SignedInOnly fallback={(card) => card}>{() => <Settings />}</SignedInOnly>
  </PageFrame>
);

const Settings = () => {
  const { session } = useIdentitySession();
  const desktop = useLayout() === "desktop";
  const { hash } = useLocation();
  const deviceList = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (hash === "#devices") deviceList.current?.scrollIntoView({ block: "start" });
  }, [hash, session, desktop]);
  if (!session) return null;
  const account = <AccountCard session={session} />;
  const notifications = (
    <AppPanel title={PROFILE_WORDS.notifications} icon="notifications">
      <NotificationsCard />
    </AppPanel>
  );
  // Music on this device: one row, which names itself.
  const music = (
    <AppPanel flush>
      <AppSetting icon="music" name={PROFILE_WORDS.music} control={<MusicSwitch />} />
    </AppPanel>
  );
  const devices = (
    <div id="devices" ref={deviceList} className="scroll-mt-4">
      <AppPanel title={PROFILE_WORDS.devices} icon="monitor" flush>
        <DevicesCard realmsId={session.user.realmsId} />
      </AppPanel>
    </div>
  );
  return desktop ? (
    <div className="grid max-w-page grid-cols-2 items-start gap-6">
      <div className="flex flex-col gap-6">
        {account}
        {devices}
        <SignOut />
      </div>
      <div className="flex flex-col gap-6">
        {notifications}
        {music}
      </div>
    </div>
  ) : (
    <div className="flex flex-col gap-6 pb-2">
      {account}
      {notifications}
      {music}
      {devices}
      <SignOut />
    </div>
  );
};

/** Another player's page, from a board: Back, their card and their finished games. */
export const PlayerPage = () => {
  const { address = "" } = useParams();
  const back = backFrom(useLocation(), "/season");
  const known = /^0x[0-9a-fA-F]{1,64}$/.test(address);
  return <PageFrame back={back}>{known ? <ProfileView account={address} own={false} /> : <NothingHere />}</PageFrame>;
};

/**
 * The page for a signed-in player, the player's account known from the session; else the card that says why not
 * (signed out, a name still to claim with Sign out under it, or this device removed), placed by the page.
 */
const SignedInOnly = ({
  fallback,
  children,
}: {
  fallback: (card: ReactNode) => ReactNode;
  children: (account: string) => ReactNode;
}) => {
  const { status, session } = useIdentitySession();
  const { data: account } = useRealmsPlayer();
  const removed = isAccountStatePrompt(useAccountStore((store) => store.provisioningError));
  if (status === "loading") return <Loading />;
  if (!session) return fallback(<SignInCard line={null} verb={WORDS.signIn} />);
  if (removed) return fallback(<SignInCard line={PROFILE_WORDS.deviceRemoved} verb={WORDS.signIn} />);
  // The flow opens on its name step for a session that has not claimed one; such a session can still sign out
  // (qa-blitz-1 #3: it had no way to).
  if (identityUsername(session) === null)
    return fallback(
      <div className="flex flex-col gap-4">
        <SignInCard line={null} verb={SIGN_IN_WORDS.claimName} />
        <SignOut />
      </div>,
    );
  return account ? children(account) : <Loading />;
};

/**
 * The lore line over Winter Fortress, then one line or none and the step. A removed device signs out first, as a new
 * device with a fresh key.
 */
const SignInCard = ({ line, verb }: { line: string | null; verb: string }) => {
  const requestSignIn = useRequestSignIn();
  const signIn = async () => {
    if (line) {
      forgetDeviceKey(localStorage);
      await signOutIdentitySession();
    }
    requestSignIn();
  };
  return (
    <AppPanel title={LORE_LINE} painting="winter-fortress">
      <div className="flex flex-col gap-4">
        {line && <p className="text-app-strong text-app-ink">{line}</p>}
        <AppButton kind="primary" size="lg" icon="person" onClick={() => void signIn()}>
          {verb}
        </AppButton>
      </div>
    </AppPanel>
  );
};

/** The player's own page: on desktop their card and the rows in the left column, their games at the right. */
const OwnProfile = ({ account }: { account: string }) => {
  if (useLayout() === "phone")
    return (
      <div className="flex flex-col gap-4">
        <ProfileView account={account} own />
        <Rows />
      </div>
    );
  return (
    <div className="grid grid-cols-[theme(width.rail)_minmax(0,1fr)] items-start gap-6">
      <div className="flex flex-col gap-5">
        <PlayerCard account={account} own />
        <Rows />
      </div>
      <RecentGames account={account} own />
    </div>
  );
};

/** Settings, then How to play. */
const Rows = () => {
  const navigate = useNavigate();
  return (
    <AppPanel flush>
      <AppSetting icon="person" name={PROFILE_WORDS.settings} onClick={() => navigate(SETTINGS_PATH)} />
      <HowToPlayRow />
    </AppPanel>
  );
};

/** How to play: the Blitz guide, in a new tab. */
const HowToPlayRow = () => <AppSetting icon="guide" name={PROFILE_WORDS.howToPlay} href={HOW_TO_PLAY} />;

const MusicSwitch = () => {
  const on = useAppMusic();
  return <AppSwitch label={PROFILE_WORDS.music} checked={on} onChange={setAppMusic} />;
};
