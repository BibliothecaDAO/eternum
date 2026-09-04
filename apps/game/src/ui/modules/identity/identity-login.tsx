import {
  identityClient,
  identityOrigin,
  useIdentitySession,
  useIdentitySessionStore,
} from "@/hooks/context/identity-session";
import Button from "@/ui/design-system/atoms/button";
import { useAccount, useConnect, useSignTypedData } from "@starknet-react/core";
import type { Connector } from "@starknet-react/core";
import { useCallback, useMemo, useState } from "react";
import { addAddressPadding } from "starknet";

interface IdentityLoginProps {
  className?: string;
}

export const IdentityLogin = ({ className = "" }: IdentityLoginProps) => {
  const { address } = useAccount();
  const { connectAsync, connectors, isPending: isConnecting } = useConnect();
  const { signTypedDataAsync, isPending: isSigning } = useSignTypedData({});
  const { status, session } = useIdentitySession();
  const applySession = useIdentitySessionStore((state) => state.applySession);
  const [error, setError] = useState<string | null>(null);

  const isSignedIn = useMemo(
    () => Boolean(address && session?.user.id && BigInt(address) === BigInt(session.user.id)),
    [address, session?.user.id],
  );

  const handleLogin = useCallback(
    async (connector?: Connector) => {
      setError(null);
      try {
        if (!address) {
          if (!connector) throw new Error("No Starknet identity wallet is available");
          await connectAsync({ connector });
          return;
        }

        const nextSession = await identityClient.signIn({
          address: addAddressPadding(address),
          chainId: "SN_MAIN",
          domain: new URL(identityOrigin).host,
          uri: identityOrigin,
          signTypedData: (message) => signTypedDataAsync(message),
        });
        applySession(nextSession);
      } catch (loginError) {
        const message = loginError instanceof Error ? loginError.message : "Identity login failed";
        console.error("identity_login_failed", { error: message });
        setError(message);
      }
    },
    [address, applySession, connectAsync, signTypedDataAsync],
  );

  const isPending = isConnecting || isSigning || status === "loading";
  const label = isSignedIn ? shortAddress(address!) : address ? "Sign in" : "Connect wallet";

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {address ? (
        <Button
          className="h-9 min-w-[128px] px-4"
          disabled={isSignedIn}
          isLoading={isPending}
          onClick={() => void handleLogin()}
        >
          {label}
        </Button>
      ) : (
        // One button per installed wallet: the identity step must offer every configured connector,
        // not silently try the first one and fail when that extension is absent. Stacked, wrapping
        // buttons: this renders inside a popover, and a connector name can be long.
        <div className="flex w-full flex-col gap-1">
          {connectors.map((connector) => (
            <Button
              key={connector.id}
              className="w-full !whitespace-normal px-4 py-2 leading-tight"
              isLoading={isPending}
              onClick={() => void handleLogin(connector)}
            >
              {connector.name}
            </Button>
          ))}
        </div>
      )}
      {error && <span className="max-w-[240px] text-center text-xs text-danger">{error}</span>}
    </div>
  );
};

const shortAddress = (address: string): string => `${address.slice(0, 6)}…${address.slice(-4)}`;
