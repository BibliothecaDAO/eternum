import { useCallback, useEffect, useMemo, useState } from "react";

import { lordsAddress, seasonPassAddress } from "@/config";
import { useAccount, useContract, useSendTransaction } from "@starknet-react/core";

import { abi } from "@/abi/SeasonPass";
import { useDojo } from "./context/dojo-context";

export const useMintSeasonPass = () => {
  const [isMinting, setIsMinting] = useState(false);
  const [mintingTokenId, setMintingTokenId] = useState(["0"]);

  const { contract } = useContract({
    abi,
    address: seasonPassAddress as `0x${string}`,
  });

  const { send, isPending, isSuccess } = useSendTransaction({});
  const {
    setup: {
      systemCalls: { attach_lords, detach_lords },
    },
  } = useDojo();

  const { account } = useAccount();

  const canMint = useMemo(() => account && !isMinting, [account, isMinting]);

  const _mint = useCallback(
    async (token_ids: string[], recipient?: string) => {
      console.log(token_ids);
      const tokenIdsNumberArray: number[] = token_ids.map((tokenId) => parseInt(tokenId, 16));
      if (!account || !contract || !canMint) {
        return;
      }

      setIsMinting(true);
      setMintingTokenId(token_ids);
      /*await mint_season_passes({
        signer: account,
        recipient: recipient ?? account.address,
        token_ids: tokenIdsNumberArray,
        season_pass_address: seasonPassAddress,
      })*/
      const calls = token_ids.map((tokenId) =>
        contract.populate("mint", [recipient ?? account.address, BigInt(tokenId)]),
      );
      try {
        await send(calls);
      } catch (e) {
        console.error(`mint error:`, e);
        setMintingTokenId(["0"]);
        setIsMinting(false);
      }
    },
    [account, canMint, contract, send],
  );

  useEffect(() => {
    if (isMinting) {
      setIsMinting(false);
    }
  }, [mintingTokenId]);

  // TODO: use Starknet React in production

  const attachLords = useCallback(
    async (token_id: number, amount: number) => {
      if (!account) return;
      await attach_lords({
        signer: account,
        token_id,
        amount,
        season_pass_address: seasonPassAddress,
        lords_address: lordsAddress,
      });
    },
    [account, seasonPassAddress],
  );

  const detachLords = useCallback(
    async (token_id: number, amount: number) => {
      if (!account) return;
      await detach_lords({ signer: account, token_id, amount, season_pass_address: seasonPassAddress });
    },
    [account, seasonPassAddress],
  );

  return {
    canMint,
    isMinting: isPending ?? isMinting,
    isMintSuccess: isSuccess,
    mint: canMint ? _mint : undefined,
    attachLords,
    detachLords,
  };
};
