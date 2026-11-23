import "./profile-view.css";

import { canonicalRealm } from "@bibliothecadao/eternum";
import { aspectName, catalogOrder, formatAmount, type AspectId } from "@bibliothecadao/types";
import { profileOfIdentityUser } from "@realms-world/identity";
import { useState, type CSSProperties } from "react";
import { useLocation } from "react-router-dom";

import { useIdentitySession } from "@/hooks/context/identity-session";
import { payoutAddressOf } from "@/hooks/context/payout-wallet";
import { useHeldRealms } from "@/hooks/use-holdings";
import { usePlayerProfile } from "@/hooks/use-player-profile";
import { playerPortraitUrl } from "@/services/identity/player-portrait";
import { aspectVariables } from "@/tokens";
import { AspectMark } from "@/ui/design-system/aspect-mark";
import { Icon } from "@/ui/design-system/icon";
import { shortAddress } from "@/ui/design-system/kit/address";
import { AppButton, AppPanel, AppPortrait, AppSetting } from "@/ui/design-system/kit/app-elements";
import { OrderEmblem } from "@/ui/design-system/kit/order-emblem";
import { PlayerName } from "@/ui/design-system/kit/player-name";
import { ServiceFailure } from "@/ui/design-system/kit/service-failure";
import {
  FRAGMENTS_PAGE_WORDS,
  HOME_STEP_WORDS,
  INVITE_WORDS,
  LORDS_EARNED,
  PROFILE_WORDS,
  RANK,
  SEASON_WORDS,
  SITES_CLEARED,
  WALLET_WORDS,
  YOUR_REALMS,
  numberedRealm,
} from "@/ui/design-system/kit/words";
import { findOwnEntry, wholeLords } from "@/ui/features/frontier/board/standings";
import { HomeArt } from "@/ui/shared/components/home-art";

import { useLayout } from "../frame/layout";
import { gameRefOf, useDirectory, useLeaderboard, useRecentResults } from "../herald";
import { Loading } from "../loading";
import { ageOf } from "../play/ages";
import { useSeasonInvite } from "../play/season-invite";
import { OwnRatingLine } from "../rating-line";
import { returnPathOf } from "../return-path";
import { chooseSeason } from "../season";
import { HistoryRow } from "../season-tab/history-row";
import { fragmentsHref } from "../shop/fragments-route";
import { useNowSeconds } from "../use-now";
import { HoldingsStrip, RealmsSheet, RealmsStatus } from "./holdings-strip";
import { linkWalletHref, SETTINGS_PATH } from "./settings-route";

const useCardProfile = (account: string, own: boolean) => {
  const { session } = useIdentitySession();
  const fromSession = own && session !== null;
  const looked = usePlayerProfile(fromSession ? null : account);
  return fromSession ? { ...profileOfIdentityUser(session.user), known: true } : looked;
};

const HISTORY = 8;

const useSeasonStanding = (account: string) => {
  const season = chooseSeason(useDirectory().data?.games ?? [], true);
  const board = useLeaderboard(season ? gameRefOf(season) : null);
  const entries = board.data?.entries;
  return { season, own: entries && findOwnEntry(entries, account), field: entries?.length };
};

export const ProfileView = ({ account, own }: { account: string; own: boolean }) =>
  useLayout() === "phone" ? (
    <div data-you-profile className="flex flex-col gap-4">
      <PlayerCard account={account} own={own} />
      {own && <WalletPanel />}
      <History account={account} own={own} />
    </div>
  ) : (
    <div data-you-profile className="grid grid-cols-[theme(width.rail)_minmax(0,1fr)] items-start gap-6">
      <PlayerCard account={account} own={own} />
      <RecentGames account={account} own={own} />
    </div>
  );

export const PlayerCard = ({
  account,
  own,
  showHoldings = true,
}: {
  account: string;
  own: boolean;
  showHoldings?: boolean;
}) => {
  const location = useLocation();
  const profile = useCardProfile(account, own);
  const { season, own: standing, field } = useSeasonStanding(account);
  const frontier = ageOf("frontier");
  const standingOrder = standing ? catalogOrder(standing.order) : undefined;
  const standingAspect = standingOrder?.aspect ?? null;
  const cardStyle = standingAspect !== null ? (aspectVariables(standingAspect) as CSSProperties) : undefined;
  const topUpTo = season ? fragmentsHref(gameRefOf(season), returnPathOf(location)) : SETTINGS_PATH;
  return (
    <div data-you-profile style={cardStyle} className="profile-card-wrap">
      <AppPanel
        title={frontier.name}
        painting={frontier.painting}
        cue={
          standing ? (
            <span className="flex items-center gap-1.5">
              {standingAspect && <AspectMark aspect={standingAspect} size={20} decorative />}
              <OrderEmblem order={standing.order} size={20} />
              <b className="text-app-gold">{`#${standing.rank}`}</b>
              {SEASON_WORDS.of} {formatAmount(field)}
            </span>
          ) : undefined
        }
      >
        <div className="profile-identity">
          <div className="profile-hero">
            <div className="profile-avatar">
              <AppPortrait
                src={profile.known ? playerPortraitUrl(account, profile.portrait) : undefined}
                name={profile.known ? (profile.name ?? "") : ""}
                size="lg"
                own={own}
              />
              {standingAspect !== null && (
                <span className="profile-avatar__facet">
                  <AspectMark aspect={standingAspect} size={28} decorative />
                </span>
              )}
            </div>
            <div className="profile-hero__info">
              <h2 className="profile-hero__name max-w-full">
                <PlayerName account={account} profile={profile.known ? profile : undefined} />
              </h2>
              {standing && standingOrder ? (
                <div className="profile-hero__sub">
                  {standingAspect && <span className="profile-hero__aspect">{aspectName(standingAspect)}</span>}
                  <span className="inline-flex items-center gap-1">
                    <OrderEmblem order={standingOrder.orderId} size={18} />
                    {standingOrder.orderName}
                  </span>
                </div>
              ) : (
                <p className="text-app-label text-app-muted">{SEASON_WORDS.notOnBoard}</p>
              )}
            </div>
          </div>
          {standing && standingOrder && (
            <>
              <div className="profile-stats">
                <div className="profile-stat">
                  <span className="profile-stat__value">
                    <Icon name="crown" size={18} />
                    {`#${standing.rank}`}
                  </span>
                  <span className="profile-stat__label">{RANK}</span>
                </div>
                <div className="profile-stat">
                  <span className="profile-stat__value">
                    <Icon name="attack" size={18} />
                    {formatAmount(standing.sites_cleared.total)}
                  </span>
                  <span className="profile-stat__label">{SITES_CLEARED}</span>
                </div>
                <div className="profile-stat">
                  <span className="profile-stat__value">
                    <Icon name="lords" size={18} />
                    {formatAmount(wholeLords(standing.rewards.lords))}
                  </span>
                  <span className="profile-stat__label">{LORDS_EARNED}</span>
                </div>
              </div>
              <div className="profile-crests">
                {standingAspect && (
                  <span className="profile-crest">
                    <AspectMark aspect={standingAspect} size={32} decorative />
                    <span className="profile-crest__name">{aspectName(standingAspect)}</span>
                  </span>
                )}
                <span className="profile-crest">
                  <OrderEmblem order={standingOrder.orderId} size={32} />
                  <span className="profile-crest__name">{standingOrder.orderName}</span>
                </span>
              </div>
            </>
          )}
          {own && (
            <div className="profile-actions">
              <AppButton kind="primary" icon="fragment" to={topUpTo} className="w-full">
                {FRAGMENTS_PAGE_WORDS.title}
              </AppButton>
              {standingAspect !== null ? (
                <InviteAction aspect={standingAspect} />
              ) : (
                <AppButton kind="secondary" icon="share" to="/season" className="w-full">
                  {INVITE_WORDS.copy}
                </AppButton>
              )}
            </div>
          )}
          {own && <OwnRatingLine />}
        </div>
        {own && showHoldings && <HoldingsStrip />}
      </AppPanel>
    </div>
  );
};

const InviteAction = ({ aspect }: { aspect: AspectId }) => {
  const invite = useSeasonInvite(aspect);
  return (
    <AppButton
      kind="secondary"
      icon="share"
      className="w-full"
      disabled={invite.link.code === undefined}
      onClick={() => void invite.copy()}
    >
      {invite.copied === "copied" ? INVITE_WORDS.copied : INVITE_WORDS.copy}
    </AppButton>
  );
};

export const WalletPanel = () => {
  const { session } = useIdentitySession();
  const location = useLocation();
  if (!session) return null;
  const payout = payoutAddressOf(session.user);
  return (
    <AppPanel title={WALLET_WORDS.payoutWallet} icon="backpack" flush>
      <AppSetting
        icon="lock"
        name={payout ? shortAddress(payout) : PROFILE_WORDS.noWallet}
        control={
          <AppButton kind="secondary" to={payout ? SETTINGS_PATH : linkWalletHref(returnPathOf(location))}>
            {payout ? PROFILE_WORDS.settings : FRAGMENTS_PAGE_WORDS.linkWallet}
          </AppButton>
        }
      />
    </AppPanel>
  );
};

const SHOWCASE_REALMS = 9;

export const RealmsShowcase = () => {
  const { wallet, held } = useHeldRealms();
  const [allOpen, setAllOpen] = useState(false);
  if (wallet === null) return null;
  if (held.isError || held.data?.length === 0)
    return (
      <AppPanel title={YOUR_REALMS} icon="realm">
        <RealmsStatus held={held} />
      </AppPanel>
    );
  const realms = held.data;
  if (!realms) return null;
  return (
    <>
      <AppPanel
        title={HOME_STEP_WORDS.yourRealmsCount(realms.length)}
        icon="realm"
        cue={
          realms.length > SHOWCASE_REALMS ? (
            <AppButton kind="secondary" onClick={() => setAllOpen(true)}>
              {HOME_STEP_WORDS.all(realms.length)}
            </AppButton>
          ) : undefined
        }
      >
        <ul className="profile-realms-grid">
          {realms.slice(0, SHOWCASE_REALMS).map(({ realmId, map }) => {
            const info = canonicalRealm(realmId);
            const order = info && info.order !== 0 ? catalogOrder(info.order) : null;
            return (
              <li key={realmId} className="profile-realm-tile">
                <HomeArt map={map} icon="realm" size={64} />
                <span className="profile-realm-tile__name">{numberedRealm(realmId, info?.name)}</span>
                {order && (
                  <span className="profile-realm-tile__order">
                    <OrderEmblem order={order.orderId} size={16} />
                    {order.orderName}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </AppPanel>
      {allOpen && <RealmsSheet held={held} onClose={() => setAllOpen(false)} />}
    </>
  );
};

export const RecentGames = ({ account, own }: { account: string; own: boolean }) => (
  <History account={account} own={own} titled />
);

const History = ({ account, own, titled = false }: { account: string; own: boolean; titled?: boolean }) => {
  const history = useRecentResults(HISTORY, account);
  const now = useNowSeconds();
  if (history.isError)
    return <ServiceFailure service="results" error={history.error} retry={() => void history.refetch()} />;
  if (history.isPending) return <Loading />;
  if (history.data.games.length === 0)
    return titled ? (
      <AppPanel title={PROFILE_WORDS.recentGames} icon="victory">
        <p className="text-app-body text-app-muted">{own ? PROFILE_WORDS.noGamesOwn : PROFILE_WORDS.noGames}</p>
      </AppPanel>
    ) : null;
  return (
    <AppPanel title={PROFILE_WORDS.recentGames} icon="victory" flush>
      {history.data.games.map((game) => (
        <HistoryRow key={`${game.chainId}:${game.game_id}`} game={game} player={account} now={now} />
      ))}
    </AppPanel>
  );
};
