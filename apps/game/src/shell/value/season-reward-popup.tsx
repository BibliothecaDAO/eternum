import "./season-reward.css";

import { formatDate, formatDuration, formatExact, LORDS } from "@bibliothecadao/types";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { useIdentitySession } from "@/hooks/context/identity-session";
import { Icon } from "@/ui/design-system/icon";
import { AppButton } from "@/ui/design-system/kit/app-elements";
import { LATER, LINK_WALLET, SEASON_REWARD_WORDS, linkWalletBy } from "@/ui/design-system/kit/words";

import { ShellWindow } from "../frame/shell-window";
import { WALLET_PATH } from "../profile/settings-route";
import { rewardWindowProgress, useRewardPopupState, useSeasonReward } from "./season-reward";
import { SeasonRewardContext, useCurrentSeasonReward } from "./season-reward-context";

export const SeasonRewardProvider = ({ children }: { children: ReactNode }) => {
  const { session } = useIdentitySession();
  if (!session) return <>{children}</>;
  return <SignedInSeasonRewardProvider>{children}</SignedInSeasonRewardProvider>;
};

const SignedInSeasonRewardProvider = ({ children }: { children: ReactNode }) => {
  const reward = useSeasonReward();
  return (
    <SeasonRewardContext.Provider value={reward}>
      {children}
      <SeasonRewardPopup />
    </SeasonRewardContext.Provider>
  );
};

const SeasonRewardPopup = () => {
  const reward = useCurrentSeasonReward();
  const popup = useRewardPopupState(reward);
  const navigate = useNavigate();

  if (!popup.open || !reward || reward.status !== "waiting") return null;

  const formattedLords = formatExact(reward.lords);
  const left = formatDuration(reward.secondsLeft);
  const deadline = formatDate(reward.deadline);
  const linkToWallet = () => {
    popup.dismiss();
    navigate(WALLET_PATH);
  };

  return (
    <ShellWindow title={SEASON_REWARD_WORDS.windowLabel} onClose={popup.dismiss}>
      <div className="reward-popup" data-reward-popup data-urgent={reward.urgent || undefined}>
        <span className="reward-popup__eyebrow">
          {SEASON_REWARD_WORDS.endedEyebrow(reward.seasonTitle, reward.aspectLabel)}
        </span>
        <h3 className="reward-popup__title">{SEASON_REWARD_WORDS.title(formattedLords)}</h3>

        <div className="reward-popup__hero">
          <span className="reward-popup__medallion">
            <Icon name="lords" size={32} />
          </span>
          <span className="reward-popup__amount">
            <span className="reward-popup__number">
              {formattedLords}
              <span className="reward-popup__unit">{LORDS}</span>
            </span>
            <span className="reward-popup__sub">{SEASON_REWARD_WORDS.gloryReward}</span>
          </span>
        </div>

        <div className="reward-popup__copy">
          <strong>{SEASON_REWARD_WORDS.automaticLine}</strong>
          <span className="reward-popup__copy-sub">{SEASON_REWARD_WORDS.noFeeLine}</span>
        </div>

        <div className="reward-popup__countdown" data-urgent={reward.urgent}>
          <div className="reward-popup__countdown-row">
            <span className="reward-popup__countdown-left">
              <Icon name="clock" size={16} />
              <span>
                {reward.urgent
                  ? SEASON_REWARD_WORDS.urgentTitle(left, formattedLords)
                  : SEASON_REWARD_WORDS.timeLeftToLink(left)}
              </span>
            </span>
            <span>{SEASON_REWARD_WORDS.closesAt(deadline)}</span>
          </div>
          <div className="reward-popup__bar">
            <div className="reward-popup__bar-fill" style={{ width: `${rewardWindowProgress(reward.secondsLeft)}%` }} />
          </div>
          <span className="reward-popup__deadline-line">
            {reward.urgent ? SEASON_REWARD_WORDS.urgentSub : linkWalletBy(deadline)}
          </span>
        </div>

        <div className="reward-popup__actions">
          <AppButton kind="primary" size="lg" icon="backpack" className="w-full" onClick={linkToWallet}>
            {reward.urgent ? SEASON_REWARD_WORDS.linkWalletNow : LINK_WALLET}
          </AppButton>
          <AppButton kind="quiet" className="w-full" onClick={popup.dismiss}>
            {LATER}
          </AppButton>
        </div>
      </div>
    </ShellWindow>
  );
};
