import "./season-reward.css";

import { formatDate, formatDuration, formatExact } from "@bibliothecadao/types";

import { Icon } from "@/ui/design-system/icon";
import { shortAddress } from "@/ui/design-system/kit/address";
import { AppButton, AppLink } from "@/ui/design-system/kit/app-elements";
import { SEASON_REWARD_WORDS, TRANSACTION } from "@/ui/design-system/kit/words";

import { WALLET_PATH } from "../profile/settings-route";
import { type SeasonRewardState, useCurrentSeasonReward } from "./season-reward-context";

export const RewardWaitingPill = () => {
  const reward = useCurrentSeasonReward();
  if (!reward || reward.status !== "waiting") return null;
  const formattedLords = formatExact(reward.lords);
  const left = formatDuration(reward.secondsLeft);
  return (
    <AppLink to={WALLET_PATH} className="reward-pill" data-reward-pill data-urgent={reward.urgent}>
      <Icon name="lords" size={16} />
      <span>{SEASON_REWARD_WORDS.waitingBadge(formattedLords)}</span>
      <span className="reward-pill__left">{`· ${left}`}</span>
    </AppLink>
  );
};

export const RewardWaitingBar = () => {
  const reward = useCurrentSeasonReward();
  if (!reward || reward.status !== "waiting") return null;
  const formattedLords = formatExact(reward.lords);
  const left = formatDuration(reward.secondsLeft);
  return (
    <AppLink to={WALLET_PATH} className="reward-phone-bar" data-reward-bar data-urgent={reward.urgent}>
      <span className="reward-phone-bar__lead">
        <Icon name="lords" size={18} />
        <span>{SEASON_REWARD_WORDS.waitingCompact(formattedLords, left)}</span>
      </span>
      <span className="reward-phone-bar__cta">{SEASON_REWARD_WORDS.linkAction}</span>
    </AppLink>
  );
};

export const RewardWaitingDot = ({ className }: { className: string }) => {
  const reward = useCurrentSeasonReward();
  if (!reward || reward.status !== "waiting") return null;
  return <span data-reward-dot className={`reward-dot ${className}`} />;
};

export const PayoutWalletRewardBanner = ({ reward }: { reward: SeasonRewardState }) => {
  const formattedLords = formatExact(reward.lords);
  if (reward.status === "waiting") {
    const left = formatDuration(reward.secondsLeft);
    const deadline = formatDate(reward.deadline);
    return (
      <section className="reward-banner" data-reward-banner="waiting" data-tone={reward.urgent ? "urgent" : "gold"}>
        <div className="reward-banner__head">
          <span className="reward-banner__lead">
            <Icon name="lords" size={26} />
            <span className="flex flex-col">
              <span className="reward-banner__title">{SEASON_REWARD_WORDS.waitingBadge(formattedLords)}</span>
              <span className="reward-banner__sub">{SEASON_REWARD_WORDS.waitingSeason(reward.seasonTitle)}</span>
            </span>
          </span>
          <span className="reward-banner__timer">
            <Icon name="clock" size={14} />
            {left}
          </span>
        </div>
        <p className="reward-banner__body">{SEASON_REWARD_WORDS.waitingPanelNote(formattedLords, deadline)}</p>
        <p className="reward-banner__sub">{SEASON_REWARD_WORDS.firstWalletZeroHold}</p>
      </section>
    );
  }
  if (reward.status === "sending") {
    return (
      <section className="reward-banner" data-reward-banner="sending" data-tone="gold">
        <div className="reward-banner__head">
          <span className="reward-banner__lead">
            <Icon name="hourglass" size={24} />
            <span className="flex flex-col">
              <span className="reward-banner__title">{SEASON_REWARD_WORDS.sendingTitle}</span>
              <span className="reward-banner__body">
                {SEASON_REWARD_WORDS.sendingBody(formattedLords, shortAddress(reward.wallet))}
              </span>
            </span>
          </span>
        </div>
      </section>
    );
  }
  return (
    <section className="reward-banner" data-reward-banner="paid" data-tone="good">
      <div className="reward-banner__head">
        <span className="reward-banner__lead">
          <Icon name="check" size={24} />
          <span className="flex flex-col">
            <span className="reward-banner__title">{SEASON_REWARD_WORDS.paidTitle(formattedLords)}</span>
            <span className="reward-banner__sub">
              {SEASON_REWARD_WORDS.paidSub(reward.seasonTitle, shortAddress(reward.wallet))}
            </span>
          </span>
        </span>
        {reward.transactionUrl && (
          <AppButton
            kind="secondary"
            icon="share"
            onClick={() => window.open(reward.transactionUrl!, "_blank", "noopener,noreferrer")}
          >
            {TRANSACTION}
          </AppButton>
        )}
      </div>
    </section>
  );
};
