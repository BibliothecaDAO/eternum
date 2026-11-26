import type { AspectId } from "@bibliothecadao/types";
import { createContext, useContext } from "react";

interface SeasonRewardBase {
  seasonKey: string;
  seasonTitle: string;
  aspect: AspectId;
  aspectLabel: string;
  lords: number;
}

export type SeasonRewardState =
  | (SeasonRewardBase & {
      status: "waiting";
      deadline: number;
      secondsLeft: number;
      urgent: boolean;
    })
  | (SeasonRewardBase & {
      status: "sending";
      wallet: string;
      deadline: number;
      secondsLeft: number;
      urgent: boolean;
    })
  | (SeasonRewardBase & {
      status: "paid";
      wallet: string;
      transactionUrl: string | null;
    });

export const SeasonRewardContext = createContext<SeasonRewardState | null>(null);

export const useCurrentSeasonReward = (): SeasonRewardState | null => useContext(SeasonRewardContext);
