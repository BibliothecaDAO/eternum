import { useCallback, useEffect, useMemo, useState } from "react";

import { lordsAddress, seasonPassAddress } from "@/config";
import { toast } from "sonner";
import { useDojo } from "./context/DojoContext";

export const useMintSeasonPass = () => {
  const [isMinting, setIsMinting] = useState(false);
  const [mintingTokenId, setMintingTokenId] = useState(["0"]);

  const {
    setup: {
      systemCalls: { attach_lords, detach_lords, mint_season_passes },
    },
    account: { account },
  } = useDojo();

  const canMint = useMemo(() => account && !isMinting, [account, isMinting]);

  const _mint = useCallback(
    async (token_ids: string[]) => {
      const tokenIdsNumberArray: number[] = token_ids.map((tokenId) => parseInt(tokenId, 16));
      if (account && canMint) {
        setIsMinting(true);
        setMintingTokenId(token_ids);
        await mint_season_passes({
          signer: account,
          recipient: account.address,
          token_ids: tokenIdsNumberArray,
          season_pass_address: seasonPassAddress,
        })
          .then(() => {
            toast("Season Passes Minted");
            // wait supply to change...
          })
          .catch((e) => {
            console.error(`mint error:`, e);
            setMintingTokenId(["0"]);
            setIsMinting(false);
          });
      }
    },
    [account, canMint],
  );

  useEffect(() => {
    if (isMinting) {
      setIsMinting(false);
    }
  }, [mintingTokenId]);

  // TODO: use Starknet React in production

  const attachLords = useCallback(
    async (token_id: number, amount: number) => {
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
      await detach_lords({ signer: account, token_id, amount, season_pass_address: seasonPassAddress });
    },
    [account, seasonPassAddress],
  );

  return {
    canMint,
    isMinting,
    mint: canMint ? _mint : undefined,
    attachLords,
    detachLords,
  };
};
