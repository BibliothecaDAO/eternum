import type { ISiwsDomain, ISiwsMessage } from "@realms-world/siws";
import { useState } from "react";
import StarknetIcon from "@/components/icons/starknet.svg?react";
import { StarknetWalletButton } from "@/components/layout/starknet-wallet-button";
import { Button } from "@/components/ui/button";
import { authClient } from "@/utils/auth-client";
import { formatAddress } from "@/utils/utils";
import { useAccount, useSignTypedData } from "@starknet-react/core";
import { env } from "env";
import { LogOut } from "lucide-react";

import { SiwsTypedData } from "@realms-world/siws";

async function createSiwsData(statement: string, address: string) {
  const nonce = await authClient.siws.nonce({ address });
  const domain = window.location.host;
  const origin = window.location.origin;
  /*const res = await fetch(`/api/auth/nonce`, {
      credentials: "include",
    });
    console.log(res);
    const responseNonce = (await res.json()) as { nonce: string };
    console.log(responseNonce);*/
  const siwsDomain: ISiwsDomain = {
    version: "0.0.1",
    chainId: env.VITE_PUBLIC_CHAIN == "sepolia" ? `SN_SEPOLIA` : `SN_MAIN`,
    name: domain,
    revision: "1",
  };
  const siwsMessage: ISiwsMessage = {
    address,
    statement,
    uri: origin,
    version: "0.0.5", //message version and not the starknetdomain version
    nonce: nonce.data?.nonce ?? "", //TODO add csrf token
    issuedAt: new Date().toISOString(),
  };

  const signindata = new SiwsTypedData(siwsDomain, siwsMessage);
  return signindata;
}

export function Login() {
  const { address } = useAccount();
  const { data: session, refetch } = authClient.useSession();
  const [isDataPending, setIsDataPending] = useState(false);

  const createSignInData = async () => {
    setIsDataPending(true);
    if (address) {
      const loginString = "Login to Realms.World with your Starknet Wallet";
      const siwsData = await createSiwsData(
        loginString,
        formatAddress(address),
      );
      setIsDataPending(false);
      return siwsData;
    }
    setIsDataPending(false);
  };

  const { signTypedDataAsync, error, isPending } = useSignTypedData({});

  if (!address) {
    return <StarknetWalletButton className="w-full" />;
  }

  if (!session) {
    return (
      <form
        //actionText="Login"
        //status={loginMutation.status}
        onSubmit={async (e) => {
          e.preventDefault();
          const signInData = await createSignInData();
          console.log(signInData);
          const signature = await signTypedDataAsync(signInData);
          await authClient.siws.verify({
            message: JSON.stringify(signInData),
            signature: signature,
            address: address,
          });
          refetch();
        }}
      >
        <Button disabled={isPending || isDataPending}>
          <StarknetIcon className="mr-2 h-6 w-6" />
          Sign in to Edit Profile
        </Button>
      </form>
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
