import { seasonPassAddress } from "@/config";
import { useMintSeasonPass } from "@/hooks/useMintSeasonPass";
import { useCall } from "@starknet-react/core";
import { useState } from "react";
import { Uint256, uint256 } from "starknet";

import { SeasonPassCard } from "./season-pass-card";

import { abi } from "@/abi/SeasonPass";
import { formatEther } from "viem";

export interface SeasonPass {
  title: string;
  description: string;
  checked?: boolean;
  owner?: string;
  name?: string;
}

export const SeasonPass = ({ title, description, checked: initialChecked, owner, name }: SeasonPass) => {
  const [isChecked, setIsChecked] = useState(initialChecked);
  const [isLoading, setIsLoading] = useState(false);
  const { attachLords } = useMintSeasonPass();

  const {
    data,
    // error,
    isLoading: isLordsBalanceLoading,
  } = useCall({
    abi: abi,
    functionName: "lords_balance",
    address: seasonPassAddress,
    args: [uint256.bnToUint256(name ?? "0")],
    watch: true,
    refetchInterval: 1000,
  });

  const handleCardClick = () => {
    setIsChecked(!isChecked);
  };

  const handleAttachLords = async (amount: number) => {
    setIsLoading(true);
    try {
      await attachLords(Number(title), amount * 10 ** 18);
    } catch (error) {
      console.log(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SeasonPassCard
      title={title}
      description={description}
      owner={owner}
      name={name}
      isChecked={isChecked ?? false}
      onCardClick={handleCardClick}
      lordsBalance={data ? formatEther(uint256.uint256ToBN(data as Uint256)) : "0"}
      isLordsBalanceLoading={isLordsBalanceLoading}
      onAttachLords={handleAttachLords}
      isAttachLoading={isLoading}
    />
  );
};
