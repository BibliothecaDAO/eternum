import "./profile-view.css";

import { canonicalRealm } from "@bibliothecadao/eternum";
import { aspectName, catalogOrder, formatAmount, type AspectId } from "@bibliothecadao/types";
import { profileOfIdentityUser } from "@realms-world/identity";
import { useState, type CSSProperties } from "react";

import { useIdentitySession } from "@/hooks/context/identity-session";
import { useHeldRealms } from "@/hooks/use-holdings";
import { usePlayerProfile } from "@/hooks/use-player-profile";
import { playerPortraitUrl } from "@/services/identity/player-portrait";
import { aspectVariables } from "@/tokens";
import { AspectMark } from "@/ui/design-system/aspect-mark";
import { Icon } from "@/ui/design-system/icon";
import { AppButton, AppPanel, AppPortrait } from "@/ui/design-system/kit/app-elements";
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
  YOUR_REALMS,
  numberedRealm,
} from "@/ui/design-system/kit/words";
import { findOwnEntry, wholeLords } from "@/ui/features/frontier/board/standings";
import { HomeArt } from "@/ui/shared/components/home-art";

import { useLayout } from "../frame/layout";
import { isAspectSeason, useDirectory, useLeaderboard, useRecentResults } from "../herald";
import { Loading } from "../loading";
import { ageOf } from "../play/ages";
import { CopySeasonInvite, SeasonInviteAlerts, useSeasonInvite } from "../play/season-invite";
import {
  chooseSeason,
  questBonusPercentOf,
  realmQuestBonus,
  SEASON_SPENDS_FRAGMENTS,
  seasonPlayerHome,
} from "../season";
import { HistoryRow } from "../season-tab/history-row";
import { useNowSeconds } from "../use-now";
import { RealmsSheet, RealmsStatus } from "./holdings-strip";

const useCardProfile = (account: string, own: boolean) => {
  const { session } = useIdentitySession();
  const fromSession = own && session !== null;
  const looked = usePlayerProfile(fromSession ? null : account);
  return fromSession ? { ...profileOfIdentityUser(session.user), known: true } : looked;
};

const HISTORY = 8;

export const useSeasonStanding = (account: string, own: boolean) => {
  const games = useDirectory().data?.games ?? [];
  const season = chooseSeason(games, true);
  const aspectSeason = isAspectSeason(season);
  const board = useLeaderboard(season ?? null);
  const entries = board.data?.entries;
  const standing = entries && findOwnEntry(entries, account);
  const home = own && aspectSeason ? seasonPlayerHome(season) : null;
  const standingOrder = standing ? catalogOrder(standing.order) : (home?.order ?? null);
  const aspect = home?.aspect ?? standingOrder?.aspect ?? null;
  return { season, standing, field: entries?.length, order: standingOrder, aspect, realm: home?.realm ?? null };
};

export const ProfileView = ({ account, own }: { account: string; own: boolean }) =>
  useLayout() === "phone" ? (
    <div data-you-profile className="flex flex-col gap-4">
      <PlayerCard account={account} own={own} />
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
  hideInvite = false,
}: {
  account: string;
  own: boolean;
  hideInvite?: boolean;
}) => {
  const profile = useCardProfile(account, own);
  const { standing, field, order, aspect, realm } = useSeasonStanding(account, own);
  const frontier = ageOf("frontier");
  const cardStyle = aspect !== null ? (aspectVariables(aspect) as CSSProperties) : undefined;
  return (
    <div data-you-profile style={cardStyle} className="profile-card-wrap">
      <AppPanel
        title={frontier.name}
        painting={frontier.painting}
        cue={
          standing ? (
            <span className="flex items-center gap-1.5">
              {aspect && <AspectMark aspect={aspect} size={20} decorative />}
              <OrderEmblem order={standing.order} size={20} />
              <b className="text-app-gold">{`#${standing.rank}`}</b>
              {SEASON_WORDS.of} {formatAmount(field)}
            </span>
          ) : realm && aspect !== null ? (
            <span className="flex items-center gap-1.5">
              <AspectMark aspect={aspect} size={20} decorative />
              <span className="text-app-ink">{realm.name}</span>
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
              {aspect !== null && (
                <span className="profile-avatar__facet">
                  <AspectMark aspect={aspect} size={28} decorative />
                </span>
              )}
            </div>
            <div className="profile-hero__info">
              <h2 className="profile-hero__name max-w-full">
                <PlayerName account={account} profile={profile.known ? profile : undefined} />
              </h2>
              {order ? (
                <div className="profile-hero__sub">
                  {aspect && <span className="profile-hero__aspect">{aspectName(aspect)}</span>}
                  <span className="inline-flex items-center gap-1">
                    <OrderEmblem order={order.orderId} size={18} />
                    {order.orderName}
                  </span>
                </div>
              ) : (
                <p className="text-app-label text-app-muted">{SEASON_WORDS.notOnBoard}</p>
              )}
            </div>
          </div>
          {standing && order && (
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
                {aspect && (
                  <span className="profile-crest">
                    <AspectMark aspect={aspect} size={32} decorative />
                    <span className="profile-crest__name">{aspectName(aspect)}</span>
                  </span>
                )}
                <span className="profile-crest">
                  <OrderEmblem order={order.orderId} size={32} />
                  <span className="profile-crest__name">{order.orderName}</span>
                </span>
              </div>
            </>
          )}
          {own && (
            <div className="profile-actions">
              {SEASON_SPENDS_FRAGMENTS && (
                <AppButton kind="primary" icon="fragment" to="/shop" className="w-full">
                  {FRAGMENTS_PAGE_WORDS.title}
                </AppButton>
              )}
              {!hideInvite &&
                (aspect !== null ? (
                  <InviteAction aspect={aspect} />
                ) : (
                  <AppButton kind="secondary" icon="share" to="/season" className="w-full">
                    {INVITE_WORDS.copy}
                  </AppButton>
                ))}
            </div>
          )}
        </div>
      </AppPanel>
    </div>
  );
};

const InviteAction = ({ aspect }: { aspect: AspectId }) => {
  const invite = useSeasonInvite(aspect);
  return (
    <div className="flex flex-col gap-2">
      <CopySeasonInvite invite={invite} size="md" icon="share" label={INVITE_WORDS.copy} className="w-full" />
      <SeasonInviteAlerts invite={invite} />
    </div>
  );
};

const SHOWCASE_REALMS = 9;

export const RealmsShowcase = ({ onLinkWallet }: { onLinkWallet?: () => void }) => {
  const { wallet, held } = useHeldRealms();
  const directory = useDirectory();
  const questBonusPercent = questBonusPercentOf(chooseSeason(directory.data?.games ?? [], true));
  const [allOpen, setAllOpen] = useState(false);
  if (wallet === null) {
    return (
      <AppPanel title={YOUR_REALMS} icon="realm">
        <div className="flex flex-col gap-3">
          <p className="text-app-body text-app-muted">{PROFILE_WORDS.noWallet}</p>
          {onLinkWallet && (
            <div>
              <AppButton kind="secondary" icon="lock" onClick={onLinkWallet}>
                {FRAGMENTS_PAGE_WORDS.linkWallet}
              </AppButton>
            </div>
          )}
        </div>
      </AppPanel>
    );
  }
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
                {questBonusPercent !== null && questBonusPercent > 0 && (
                  <span className="profile-realm-tile__bonus">
                    <Icon name="labor" size={14} />
                    {realmQuestBonus(questBonusPercent, Boolean(info?.wonder))}
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
  const frontierGames = history.data.games.filter((game) => game.mode === "frontier");
  if (frontierGames.length === 0)
    return titled ? (
      <AppPanel title={PROFILE_WORDS.recentGames} icon="victory">
        <p className="text-app-body text-app-muted">{own ? PROFILE_WORDS.noGamesOwn : PROFILE_WORDS.noGames}</p>
      </AppPanel>
    ) : null;
  return (
    <AppPanel title={PROFILE_WORDS.recentGames} icon="victory" flush>
      {frontierGames.map((game) => (
        <HistoryRow key={`${game.chainId}:${game.game_id}`} game={game} player={account} now={now} />
      ))}
    </AppPanel>
  );
};
