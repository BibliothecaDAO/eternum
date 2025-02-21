import type { ISiwsDomain, ISiwsMessage } from "@realms-world/siws";
import { useEffect, useState } from "react";
import StarknetIcon from "@/components/icons/starknet.svg?react";
import { Button } from "@/components/ui/button";
//import authClient from "@/utils/auth-client";
//import { useMutation } from "@/hooks/use-mutation";
//import { loginFn } from "@/routes/_authed";
import { formatAddress } from "@/utils/utils";
import { useAccount, useSignTypedData } from "@starknet-react/core";
import { useRouter } from "@tanstack/react-router";
import { env } from "env";

import { SiwsTypedData } from "@realms-world/siws";

function createSiwsData(statement: string, address: string) {
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
    nonce: "0x0x9e9eew", //TODO add csrf token
    issuedAt: new Date().toISOString(),
  };

  const signindata = new SiwsTypedData(siwsDomain, siwsMessage);
  return signindata;
}

export function Login() {
  const router = useRouter();
  const { address } = useAccount();
  const [signInData, setSignInData] = useState<SiwsTypedData>();
  //  const { data: session } = useSession();

  useEffect(() => {
    const createSignInData = async () => {
      if (address) {
        const loginString = "Login to Realms.World with your Starknet Wallet";
        const siwsData = createSiwsData(loginString, formatAddress(address));
        setSignInData(siwsData);
        return siwsData;
      }
    };
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    createSignInData();
  }, [address]);

  const { signTypedDataAsync, error, isPending } = useSignTypedData({
    params: signInData,
  });

  /*const loginMutation = useMutation({
    //fn: loginFn,
    onSuccess: async (ctx) => {
      /*if (!ctx.data?.error) {
        await router.invalidate();
        await router.navigate({ to: "/" });
        return;
      }
    },
  });*/

  return (
    <form
      //actionText="Login"
      //status={loginMutation.status}
      onSubmit={async (e) => {
        e.preventDefault();
        const signature = await signTypedDataAsync(signInData);
        /*const response = await authClient.signIn("starknet", {
          credentials: {
            message: JSON.stringify(signInData),
            signature: signature,
          },
          redirectTo: "/", // Optional: specify where to redirect after successful login
        });*/
        /*await loginFn({
          data: {
            credentials: {
              message: JSON.stringify(signInData),
              redirect: false,
              signature: signature,
            },
          },
        });*/
      }}
    >
      <Button /* disabled={isPending}*/>
        <StarknetIcon className="mr-2 h-6 w-6" />
        Sign in with Starknet
      </Button>
    </form>
  );
}
