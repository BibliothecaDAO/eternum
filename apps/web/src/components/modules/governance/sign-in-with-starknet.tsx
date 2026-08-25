import type { ISiwsDomain, ISiwsMessage } from "@realms-world/siws";
import { useState } from "react";
import StarknetIcon from "@/components/icons/starknet.svg?react";
import { StarknetWalletButton } from "@/components/layout/starknet-wallet-button";
import { Button } from "@/components/ui/button";
import { authClient } from "@/utils/auth-client";
import { formatAddress } from "@/utils/utils";
import { useAccount, useSignTypedData } from "@starknet-start/react";
import { env } from "env";
import { LogOut } from "lucide-react";

import { SiwsTypedData } from "@realms-world/siws";

function getAuthHost() {
  const baseUrl = (import.meta.env.VITE_BASE_URL as string | undefined) ?? "";
  if (baseUrl) {
    try {
      return new URL(baseUrl).host;
    } catch {
      // Fall through to window location.
    }
  }
  return window.location.host;
}

function resolveSiwsChainId(chainId?: bigint) {
  if (chainId === BigInt("0x534e5f5345504f4c4941")) return "SN_SEPOLIA";
  if (chainId === BigInt("0x534e5f4d41494e")) return "SN_MAIN";
  return env.VITE_PUBLIC_CHAIN == "sepolia" ? "SN_SEPOLIA" : "SN_MAIN";
}

async function createSiwsData(statement: string, address: string, chainId?: bigint) {
  const nonce = await authClient.siws.nonce({ address });
  const domain = getAuthHost();
  const origin = window.location.origin;
  const siwsDomain: ISiwsDomain = {
    version: "0.0.1",
    chainId: resolveSiwsChainId(chainId),
    name: domain,
    revision: "1",
  };
  const siwsMessage: ISiwsMessage = {
    address,
    statement,
    uri: origin,
    version: "0.0.5",
    nonce: nonce.data?.nonce ?? "",
    issuedAt: new Date().toISOString(),
  };

  const signindata = new SiwsTypedData(siwsDomain, siwsMessage);
  return signindata;
}

export function Login() {
  const { address, chainId } = useAccount();
  const { data: session, refetch } = authClient.useSession();
  const [isDataPending, setIsDataPending] = useState(false);

  const createSignInData = async () => {
    setIsDataPending(true);
    if (address) {
      const loginString = "Login to Realms.World with your Starknet Wallet";
      const siwsData = await createSiwsData(loginString, formatAddress(address), chainId);
      setIsDataPending(false);
      return siwsData;
    }
    setIsDataPending(false);
  };

  const { signTypedDataAsync, isPending } = useSignTypedData({});

  if (!address) {
    return <StarknetWalletButton className="w-full" />;
  }

  if (!session) {
    return (
      <Button
        onClick={async (e) => {
          e.preventDefault();
          const signInData = await createSignInData();
          if (!signInData) {
            return;
          }
          const signature = await signTypedDataAsync(signInData);
          await authClient.siws.verify({
            message: JSON.stringify(signInData),
            signature: signature,
            address: address,
          });
          await refetch();
        }}
        disabled={isPending || isDataPending}
      >
        <StarknetIcon className="mr-2 h-6 w-6" />
        Sign in to Edit Profile
      </Button>
    );
  }

  return (
    <div>
      <Button
        className="w-full"
        variant={"outline"}
        onClick={async () => {
          await authClient.signOut();
        }}
      >
        <LogOut />
        Logout
      </Button>
    </div>
  );
}
