import "./profile-view.css";

import { LORE_LINE, PROFILE_WORDS, SIGN_IN_WORDS, WALLET_WORDS, WORDS } from "@/ui/design-system/kit/words";
import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";

import { isAccountStatePrompt } from "@/hooks/context/gameplay-account-sync";
import {
  identityUsername,
  signOutIdentitySession,
  useIdentitySession,
  useIdentitySessionStore,
} from "@/hooks/context/identity-session";
import { payoutAddressOf } from "@/hooks/context/payout-wallet";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import { AppButton, AppPanel, AppSetting, AppSwitch, AppTabs } from "@/ui/design-system/kit/app-elements";
import { forgetDeviceKey } from "@bibliothecadao/eternum";

import { setAppMusic, useAppMusic } from "../app-music";
import { useLayout } from "../frame/layout";
import { PageFrame } from "../frame/page-frame";
import { useRealmsPlayer } from "../herald";
import { Loading } from "../loading";
import { NothingHere } from "../not-found";
import { nextOf } from "../return-path";
import { useRequestSignIn } from "../sign-in/connect";
import { AccountCard, SignOut } from "./account-card";
import { DeleteAccount } from "./account-deletion";
import { DevicesCard } from "./devices-page";
import { NotificationsCard } from "./notifications";
import { PayoutWalletPanel } from "./payout-wallet-panel";
import { PlayerCard, ProfileView, RealmsShowcase, RecentGames, useOwnSeasonStanding } from "./profile-view";
import { DELETE_ACCOUNT_HASH, DEVICES_HASH } from "./settings-route";
import { SharedDaysPanel } from "./shared-days-panel";

type HubTab = "overview" | "referrals" | "wallet" | "settings";

const HUB_TABS: readonly { key: HubTab; label: string; short: string; icon: IconMeaning }[] = [
  { key: "overview", label: PROFILE_WORDS.overviewTab, short: PROFILE_WORDS.overviewShort, icon: "realm" },
  { key: "referrals", label: PROFILE_WORDS.referralsTab, short: PROFILE_WORDS.referralsShort, icon: "people" },
  { key: "wallet", label: PROFILE_WORDS.walletTab, short: PROFILE_WORDS.walletShort, icon: "backpack" },
  { key: "settings", label: PROFILE_WORDS.settings, short: PROFILE_WORDS.settingsShort, icon: "person" },
];

const TAB_HASH: Record<HubTab, string> = {
  overview: "#realms",
  referrals: "#referrals",
  wallet: "#wallet",
  settings: "#settings",
};

const TAB_BY_HASH = new Map<string, HubTab>([
  ...(Object.entries(TAB_HASH) as [HubTab, string][]).map(([tab, hash]) => [hash, tab] as const),
  [DEVICES_HASH, "wallet"],
  [DELETE_ACCOUNT_HASH, "settings"],
]);

const hubTabFromLocation = (hash: string, search: string): HubTab =>
  TAB_BY_HASH.get(hash) ?? (nextOf(search) !== null ? "wallet" : "overview");

export const ProfilePage = () => {
  const { hash, search } = useLocation();
  const desktop = useLayout() === "desktop";
  const tab = hubTabFromLocation(hash, search);
  return (
    <PageFrame title={desktop ? WORDS.you : undefined}>
      <SignedInOnly fallback={(card) => <SignedOut card={card} />}>
        {(account) => <AccountHub account={account} tab={tab} />}
      </SignedInOnly>
    </PageFrame>
  );
};

export const SettingsRedirect = () => {
  const { pathname, search, hash } = useLocation();
  const targetHash = hash || (nextOf(search) !== null ? TAB_HASH.wallet : TAB_HASH.settings);
  return <Navigate to={{ pathname: pathname.replace(/\/settings\/?$/, ""), search, hash: targetHash }} replace />;
};

const SignedOut = ({ card }: { card: ReactNode }) => <div className="flex max-w-column flex-col gap-4">{card}</div>;

const useReturnOnceLinked = (returnTo: string | null, payout: string | null) => {
  const navigate = useNavigate();
  const [linkedOnArrival] = useState(payout !== null);
  useEffect(() => {
    if (returnTo && payout && !linkedOnArrival) navigate(returnTo, { replace: true });
  }, [linkedOnArrival, navigate, payout, returnTo]);
};

const AccountHub = ({ account, tab }: { account: string; tab: HubTab }) => {
  const { session } = useIdentitySession();
  const refresh = useIdentitySessionStore((state) => state.refresh);
  const desktop = useLayout() === "desktop";
  const { hash, search } = useLocation();
  const navigate = useNavigate();
  const standing = useOwnSeasonStanding(account);
  const payout = session ? payoutAddressOf(session.user) : null;
  useReturnOnceLinked(nextOf(search), payout);
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: "start" });
  }, [hash, tab, desktop]);
  if (!session) return null;
  const openTab = (next: HubTab) => navigate({ hash: TAB_HASH[next], search }, { replace: true });
  const workspace = (
    <div className="you-workspace" data-you-tab={tab}>
      {tab === "overview" && (
        <>
          <RealmsShowcase onLinkWallet={() => openTab("wallet")} />
          <RecentGames account={account} own />
        </>
      )}
      {tab === "referrals" && <SharedDaysPanel aspect={standing.aspect} aspectPending={standing.aspectPending} />}
      {tab === "wallet" && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <AppPanel title={WALLET_WORDS.payoutWallet} icon="backpack">
            <PayoutWalletPanel wallet={payout} email={session.user.email} onChanged={() => void refresh()} />
          </AppPanel>
          <div id="devices" className="scroll-mt-4">
            <AppPanel title={PROFILE_WORDS.devices} icon="monitor" flush>
              <DevicesCard realmsId={session.user.realmsId} />
            </AppPanel>
          </div>
        </div>
      )}
      {tab === "settings" && (
        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
          <div className="flex flex-col gap-5">
            <AccountCard session={session} />
            <SignOut />
            <DeleteAccount email={session.user.email} />
          </div>
          <div className="flex flex-col gap-5">
            <AppPanel title={PROFILE_WORDS.notifications} icon="notifications">
              <NotificationsCard />
            </AppPanel>
            <AppPanel flush>
              <AppSetting icon="music" name={PROFILE_WORDS.music} control={<MusicSwitch />} />
            </AppPanel>
          </div>
        </div>
      )}
    </div>
  );
  if (!desktop) {
    return (
      <div className="flex flex-col gap-4" data-you-hub>
        <PlayerCard account={account} own standing={standing} hideInvite={tab === "referrals"} />
        <AppTabs
          label={PROFILE_WORDS.tabsLabel}
          value={tab}
          onChange={openTab}
          tabs={HUB_TABS.map(({ key, short }) => ({ key, label: short }))}
        >
          <div className="pt-4">{workspace}</div>
        </AppTabs>
      </div>
    );
  }
  return (
    <div className="you-hub" data-you-hub>
      <aside className="you-rail">
        <PlayerCard account={account} own standing={standing} hideInvite={tab === "referrals"} />
        <nav className="you-rail__nav" role="tablist" aria-label={PROFILE_WORDS.tabsLabel}>
          {HUB_TABS.map(({ key, label, icon }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              className="app-tabs__tab you-rail__tab"
              onClick={() => openTab(key)}
            >
              <Icon name={icon} size={20} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </aside>
      <div className="min-w-0">{workspace}</div>
    </div>
  );
};

export const PlayerPage = () => {
  const { address = "" } = useParams();
  const known = /^0x[0-9a-fA-F]{1,64}$/.test(address);
  return <PageFrame>{known ? <ProfileView account={address} own={false} /> : <NothingHere />}</PageFrame>;
};

export const SignedInOnly = ({
  fallback,
  children,
}: {
  fallback: (card: ReactNode) => ReactNode;
  children: (account: string) => ReactNode;
}) => {
  const { session } = useIdentitySession();
  const { data: account } = useRealmsPlayer();
  const removed = isAccountStatePrompt(useAccountStore((store) => store.provisioningError));
  if (!session) return fallback(<SignInCard line={null} verb={WORDS.signIn} />);
  if (removed) return fallback(<SignInCard line={PROFILE_WORDS.deviceRemoved} verb={WORDS.signIn} />);
  if (identityUsername(session) === null)
    return fallback(
      <div className="flex flex-col gap-4">
        <SignInCard line={null} verb={SIGN_IN_WORDS.claimName} />
        <SignOut />
      </div>,
    );
  return account ? children(account) : <Loading />;
};

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

const MusicSwitch = () => {
  const on = useAppMusic();
  return <AppSwitch label={PROFILE_WORDS.music} checked={on} onChange={setAppMusic} />;
};
