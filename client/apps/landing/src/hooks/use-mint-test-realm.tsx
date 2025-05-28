import { realmsAddress } from "@/config";
import { useAccount } from "@starknet-react/core";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useDojo } from "./context/dojo-context";

export const useMintTestRealm = () => {
  const {
    setup: {
      systemCalls: { mint_test_realm },
    },
  } = useDojo();

  const { account } = useAccount();

  const [isMinting, setIsMinting] = useState(false);
  const [mintingTokenId, setMintingTokenId] = useState(0);

  const canMint = useMemo(() => account && !isMinting, [account, isMinting]);

  const _mint = useCallback(
    async (token_id: number) => {
      if (account && canMint) {
        setIsMinting(true);
        setMintingTokenId(token_id);
        console.log("account", { signer: account, token_id, realms_address: realmsAddress });
        await mint_test_realm({ signer: account, token_id: BigInt(token_id), realms_address: realmsAddress })
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
    [account, canMint, mint_test_realm],
  );

  useEffect(() => {
    if (isMinting) {
      setIsMinting(false);
    }
  }, [mintingTokenId]);

  return {
    canMint,
    isMinting,
    mint: canMint ? _mint : undefined,
  };
};
