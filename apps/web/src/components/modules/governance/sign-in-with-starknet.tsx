import { useState } from "react";
import StarknetIcon from "@/components/icons/starknet.svg?react";
import { StarknetWalletButton } from "@/components/layout/starknet-wallet-button";
import { Button } from "@/components/ui/button";
import { authClient } from "@/utils/auth-client";
import { formatAddress } from "@/utils/utils";
import { useAccount, useSignTypedData } from "@starknet-start/react";
import { env } from "env";
import { LogOut } from "lucide-react";

import { createIdentityClient } from "@realms-world/identity";

const identityClient = createIdentityClient({ baseUrl: `${env.VITE_BASE_URL}/api/auth` });

export function Login() {
  const { address } = useAccount();
  const { data: session, refetch } = authClient.useSession();
  const [isDataPending, setIsDataPending] = useState(false);

  const { signTypedDataAsync, isPending } = useSignTypedData({});

  if (!address) {
    return <StarknetWalletButton className="w-full" />;
  }

  if (!session) {
    return (
      <Button
        onClick={async (e) => {
          e.preventDefault();
          setIsDataPending(true);
          try {
            await identityClient.signIn({
              address: formatAddress(address),
              chainId: "SN_MAIN",
              domain: new URL(env.VITE_BASE_URL).host,
              uri: env.VITE_BASE_URL,
              signTypedData: async (message) => signTypedDataAsync(message),
            });
            await refetch();
          } finally {
            setIsDataPending(false);
          }
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
