import { useEffect, useRef, type ReactNode } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { isAccountStatePrompt } from "@/hooks/context/gameplay-account-sync";
import { identityUsername, signOutIdentitySession, useIdentitySession } from "@/hooks/context/identity-session";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { Button } from "@/ui/design-system/kit/button";
import { forgetDeviceKey } from "@bibliothecadao/eternum";
import type { Session } from "@realms-world/identity";

import { setAppMusic, useAppMusic } from "../app-music";
import { backFrom } from "../frame/opened-from";
import { useLayout } from "../frame/layout";
import { PageFrame } from "../frame/page-frame";
import { useRealmsPlayer } from "../herald";
import { WHATS_NEW_PATH } from "../news/posts";
import { Loading } from "../loading";
import { NothingHere } from "../not-found";
import { paintingSources } from "../paintings";
import { useRequestSignIn } from "../sign-in/sign-in-route";
import { PROFILE_WORDS, SIGN_IN_WORDS, WORDS } from "../words";
import { AccountCard, SignOut } from "./account-card";
import { DevicesCard } from "./devices-page";
import { NotificationsCard } from "./notifications";
import { PlayerCard, ProfileView, RecentGames } from "./profile-view";
import { SETTINGS_PATH } from "./settings-route";
import { SettingRow, SettingRows } from "./setting-row";
import { Switch } from "./switch";

/** The docs site, where each mode's rules are written down (apps/game-docs). */
const HOW_TO_PLAY = "https://docs.realms.world";

/**
 * You (spec 10, the place): the player's page as others see it, their finished games, then three rows: Settings, How
 * to play (the docs site) and What's new. Signed out, one card with Sign in above the two rows anyone can read; a
 * device removed elsewhere, one card with Sign in to add it back.
 */
export const ProfilePage = () => (
  <PageFrame title={useLayout() === "desktop" ? WORDS.you : undefined}>
    <SignedInOnly fallback={(card) => <SignedOut card={card} />}>
      {(account) => <OwnProfile account={account} />}
    </SignedInOnly>
  </PageFrame>
);

/** Signed out: the card that says why, then what anyone can read. */
const SignedOut = ({ card }: { card: ReactNode }) => (
  <div className="flex max-w-column flex-col gap-4">
    {card}
    <SettingRows>
      <ReadingRows />
    </SettingRows>
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
  const account = <AccountGroup session={session} />;
  const notifications = (
    <Group title={PROFILE_WORDS.notifications}>
      <NotificationsCard />
    </Group>
  );
  // Music on this device: one row, which names itself.
  const music = (
    <SettingRows>
      <SettingRow icon="music" name={PROFILE_WORDS.music} end={<MusicSwitch />} />
    </SettingRows>
  );
  const devices = (
    <div id="devices" ref={deviceList} className="scroll-mt-4">
      <Group title={PROFILE_WORDS.devices}>
        <DevicesCard realmsId={session.user.realmsId} />
      </Group>
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

const AccountGroup = ({ session }: { session: Session }) => (
  <Group title={PROFILE_WORDS.account}>
    <AccountCard session={session} />
  </Group>
);

/** A titled group of settings. */
const Group = ({ title, children }: { title: string; children: ReactNode }) => (
  <section aria-label={title} className="flex flex-col gap-2">
    <h2 className="px-2 font-body text-base font-bold text-kit-gold">{title}</h2>
    {children}
  </section>
);

/** Another player's page, from a board: Back, their card and their finished games. */
export const PlayerPage = () => {
  const { address = "" } = useParams();
  const back = backFrom(useLocation(), "/season");
  const known = /^0x[0-9a-fA-F]{1,64}$/.test(address);
  return <PageFrame back={back}>{known ? <ProfileView account={address} own={false} /> : <NothingHere />}</PageFrame>;
};

/**
 * The page for a signed-in player, the player's account known from the session; else the card that says why not
 * (signed out, a name still to claim, or this device removed), placed by the page.
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
  // The flow opens on its name step for a session that has not claimed one.
  if (identityUsername(session) === null) return fallback(<SignInCard line={null} verb={SIGN_IN_WORDS.claimName} />);
  return account ? children(account) : <Loading />;
};

/**
 * One line or none and the step, from the top, over Winter Fortress. A removed device signs out first, as a new device
 * with a fresh key.
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
    <section className="painted flex min-h-44 flex-col gap-3 rounded-plate p-3.5">
      <img
        {...paintingSources("winter-fortress")}
        sizes="(min-width: 1024px) 34rem, 100vw"
        alt=""
        className="absolute inset-0 -z-10 size-full object-cover"
      />
      <span className="absolute inset-0 -z-10 bg-gradient-to-b from-kit-ground/85 to-transparent" />
      {line && <p className="font-body text-base font-bold text-kit-cream">{line}</p>}
      <Button role="primary" word={verb} icon="person" onClick={() => void signIn()} />
    </section>
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
      <RecentGames account={account} />
    </div>
  );
};

/** Settings, then what anyone can read. */
const Rows = () => {
  const navigate = useNavigate();
  return (
    <SettingRows>
      <SettingRow icon="person" name={PROFILE_WORDS.settings} onOpen={() => navigate(SETTINGS_PATH)} />
      <ReadingRows />
    </SettingRows>
  );
};

/** How to play, on the docs site in a new tab, and What's new. */
const ReadingRows = () => {
  const navigate = useNavigate();
  return (
    <>
      <SettingRow icon="guide" name={PROFILE_WORDS.howToPlay} href={HOW_TO_PLAY} />
      <SettingRow icon="chronicles" name={PROFILE_WORDS.whatsNew} onOpen={() => navigate(WHATS_NEW_PATH)} />
    </>
  );
};

const MusicSwitch = () => {
  const on = useAppMusic();
  return <Switch on={on} label={PROFILE_WORDS.music} onToggle={() => setAppMusic(!on)} />;
};
