import { useCallback, useEffect, useMemo, useState } from "react";
//import { useIsCorrectChain } from "./useChain";
//import { useConfig, useTokenContract, useTokenOwner, useTotalSupply } from "./useToken";
//import { bigintEquals } from "../utils/types";
//import { goToTokenPage } from "../utils/karat";
import { toast } from "sonner";
import { useDojo } from "./context/DojoContext";

export const useMintSeasonPass = () => {
  const {
    setup: {
      systemCalls: { mint_season_passes },
    },
  } = useDojo();

  const season_pass_address = BigInt(import.meta.env.VITE_SEASON_PASS_ADDRESS);

  const {
    account: { account },
  } = useDojo();

  //const { contractAddress } = useTokenContract();
  //const { isCoolDown, maxSupply, availableSupply } = useConfig();
  //  const { isConnected } = useAccount();
  //const { isCorrectChain } = useIsCorrectChain()
  // const { totalSupply } = useTotalSupply()

  const [isMinting, setIsMinting] = useState(false);
  const [mintingTokenId, setMintingTokenId] = useState(["0"]);

  const canMint = useMemo(
    () => account /*&& isConnected /*&& isCorrectChain*/ && !isMinting,
    [account, /*isConnected, /*isCorrectChain,*/ isMinting],
  );

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
          season_pass_address,
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
    [account, canMint, season_pass_address, mint_season_passes],
  );

  useEffect(() => {
    if (isMinting /*&& totalSupply >= mintingTokenId*/) {
      // ...supply changed, to to token!
      setIsMinting(false);
      //goToTokenPage(mintingTokenId);
    }
  }, [mintingTokenId /*, totalSupply*/]);

  //const { ownerAddress: lastOwnerAddress } = useTokenOwner(totalSupply);

  return {
    canMint,
    isMinting,
    mint: canMint ? _mint : undefined,
  };
};
