import type { ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { isAccountStatePrompt } from "@/hooks/context/gameplay-account-sync";
import { notificationOwnerOf, signOutIdentitySession, useIdentitySession } from "@/hooks/context/identity-session";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useNotificationPreferences } from "@/hooks/use-notification-preferences";
import { Button } from "@/ui/design-system/kit/button";
import { forgetDeviceKey } from "@bibliothecadao/eternum";

import { setAppMusic, useAppMusic } from "../app-music";
import { useLayout } from "../frame/layout";
import { PageFrame } from "../frame/page-frame";
import { useRealmsPlayer } from "../herald";
import { Loading } from "../loading";
import { NothingHere } from "../not-found";
import { paintingSources } from "../paintings";
import { useRequestSignIn } from "../sign-in/sign-in-route";
import { LEVEL_WORDS, PROFILE_WORDS, WORDS } from "../words";
import { AccountCard } from "./account-card";
import { DevicesCard } from "./devices-page";
import { NotificationsCard, shownLevel } from "./notifications";
import { PlayerCard, ProfileView, RecentGames } from "./profile-view";
import { SettingRow, SettingRows } from "./setting-row";
import { Switch } from "./switch";

type ProfileRow = "account" | "notifications" | "devices";

const ROW_PATH: Record<ProfileRow, string> = {
  account: "/profile/account",
  notifications: "/profile/notifications",
  devices: "/profile/devices",
};

/**
 * Profile (spec 10, the tab): the player's page as others see it, then Account, Notifications and Devices. Signed
 * out, one card with Sign in; a device removed elsewhere, one card with Sign in to add it back.
 */
export const ProfilePage = () => (
  <PageFrame>
    <SignedInOnly>{(account) => <OwnProfile account={account} open={null} />}</SignedInOnly>
  </PageFrame>
);

/** Account, Notifications and Devices: pages from Profile on a phone; on desktop the open row's right panel. */
export const ProfileRowPage = ({ row }: { row: ProfileRow }) => {
  const layout = useLayout();
  return (
    <PageFrame back={layout === "phone" ? "/profile" : undefined} title={ROW_TITLE[row]}>
      <SignedInOnly>
        {(account) => (layout === "phone" ? <RowCard row={row} /> : <OwnProfile account={account} open={row} />)}
      </SignedInOnly>
    </PageFrame>
  );
};

const ROW_TITLE: Record<ProfileRow, string> = {
  account: PROFILE_WORDS.account,
  notifications: PROFILE_WORDS.notifications,
  devices: PROFILE_WORDS.devices,
};

/** Another player's page, from a list: Back, their banner, figure and finished games. */
export const PlayerPage = () => {
  const { address = "" } = useParams();
  const known = /^0x[0-9a-fA-F]{1,64}$/.test(address);
  return (
    <PageFrame back="/season">{known ? <ProfileView account={address} own={false} /> : <NothingHere />}</PageFrame>
  );
};

/** The page for a signed-in player, the player's account known from the session; else the card that says why not. */
const SignedInOnly = ({ children }: { children: (account: string) => ReactNode }) => {
  const { status, session } = useIdentitySession();
  const { data: account } = useRealmsPlayer();
  const removed = isAccountStatePrompt(useAccountStore((store) => store.provisioningError));
  if (status === "loading") return <Loading />;
  if (!session) return <SignInCard line={null} />;
  if (removed) return <SignInCard line={PROFILE_WORDS.deviceRemoved} />;
  return account ? children(account) : <Loading />;
};

/** Winter Fortress, one line or none, and Sign in. A removed device signs out first, as a new device with a fresh key. */
const SignInCard = ({ line }: { line: string | null }) => {
  const requestSignIn = useRequestSignIn();
  const signIn = async () => {
    if (line) {
      forgetDeviceKey(localStorage);
      await signOutIdentitySession();
    }
    requestSignIn("/profile");
  };
  return (
    <section className="flex flex-col gap-3 plate p-3.5">
      <img
        {...paintingSources("winter-fortress")}
        sizes="(min-width: 1024px) 34rem, 100vw"
        alt=""
        className="h-44 w-full rounded-xl object-cover"
      />
      {line && <p className="font-ui text-[17px] font-bold text-kit-cream">{line}</p>}
      <Button role="primary" word={WORDS.signIn} icon="Pf" onClick={() => void signIn()} />
    </section>
  );
};

/** The player's own Profile: on desktop their card and the rows in the left column, their games or the open row at the right. */
const OwnProfile = ({ account, open }: { account: string; open: ProfileRow | null }) => {
  const layout = useLayout();
  if (layout === "phone")
    return (
      <div className="flex flex-col gap-4">
        <ProfileView account={account} own />
        <Rows />
      </div>
    );
  return (
    <div className="grid grid-cols-[26rem_minmax(0,1fr)] items-start gap-6">
      <div className="flex flex-col gap-5">
        <PlayerCard account={account} own />
        <Rows />
      </div>
      {open ? <RowCard row={open} /> : <RecentGames account={account} />}
    </div>
  );
};

/** Account, Notifications (with its level) and Devices, each opening its page or panel; Music switches here. */
const Rows = () => {
  const navigate = useNavigate();
  const { session } = useIdentitySession();
  const preferences = useNotificationPreferences(notificationOwnerOf(session));
  const level = shownLevel(preferences.saved?.level);
  return (
    <SettingRows>
      <SettingRow icon="Pf" name={PROFILE_WORDS.account} onOpen={() => navigate(ROW_PATH.account)} />
      <SettingRow
        icon="Bl"
        name={PROFILE_WORDS.notifications}
        value={level ? LEVEL_WORDS[level].word : "—"}
        onOpen={() => navigate(ROW_PATH.notifications)}
      />
      <SettingRow icon="Dv" name={PROFILE_WORDS.devices} onOpen={() => navigate(ROW_PATH.devices)} />
      <SettingRow icon="Mu" name={PROFILE_WORDS.music} end={<MusicSwitch />} />
    </SettingRows>
  );
};

const MusicSwitch = () => {
  const on = useAppMusic();
  return <Switch on={on} label={PROFILE_WORDS.music} onToggle={() => setAppMusic(!on)} />;
};

const RowCard = ({ row }: { row: ProfileRow }) => {
  const { session } = useIdentitySession();
  if (!session) return null;
  switch (row) {
    case "account":
      return <AccountCard session={session} />;
    case "notifications":
      return <NotificationsCard />;
    case "devices":
      return <DevicesCard realmsId={session.user.realmsId} />;
  }
};
