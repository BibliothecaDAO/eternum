import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { useDojo } from "./context/DojoContext";
import useAccountOrBurner from "./useAccountOrBurner";

export const useMintTestRealm = () => {
  const {
    setup: {
      systemCalls: { mint_test_realm },
    },
  } = useDojo();

  const realms_address = BigInt(import.meta.env.VITE_REALMS_ADDRESS);

  const { account } = useAccountOrBurner();

  const [isMinting, setIsMinting] = useState(false);
  const [mintingTokenId, setMintingTokenId] = useState(0);

  const canMint = useMemo(
    () => account /*&& isConnected /*&& isCorrectChain*/ && !isMinting,
    [account, /*isConnected, /*isCorrectChain,*/ isMinting],
  );

  const _mint = useCallback(
    async (token_id: number) => {
      if (account && canMint) {
        setIsMinting(true);
        setMintingTokenId(token_id);

        console.log("------> mint_test_realm", account);
        console.log("------> mint_test_realm", token_id);
        console.log("------> mint_test_realm", realms_address);
        await mint_test_realm({
          signer: account,
          token_id: BigInt(token_id),
          realms_address: import.meta.env.VITE_REALMS_ADDRESS,
        })
          .then(() => {
            toast(`Realms #${token_id} Minted`);
          })
          .catch((e) => {
            console.error(`mint error:`, e);
            setMintingTokenId(0);
            setIsMinting(false);
          });
      }
    },
    [account, canMint, mint_test_realm, realms_address],
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
