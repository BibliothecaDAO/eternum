import { env } from "../../../../env";
import { IDENTITY_SESSION_CHANGED_EVENT, notifyIdentitySessionChanged } from "@/hooks/context/identity-session";
import Button from "@/ui/design-system/atoms/button";
import { resolveEndpoint } from "@realms-world/chain";
import { createIdentityClient, type Session } from "@realms-world/identity";
import { useAccount, useConnect, useSignTypedData } from "@starknet-react/core";
import type { Connector } from "@starknet-react/core";
import { useCallback, useEffect, useMemo, useState } from "react";
import { addAddressPadding } from "starknet";

const identityOrigin = resolveEndpoint(env.VITE_PUBLIC_IDENTITY_ORIGIN, {
  name: "VITE_PUBLIC_IDENTITY_ORIGIN",
  browserFacing: true,
});
const identityClient = createIdentityClient({ baseUrl: `${identityOrigin}/api/auth` });

interface IdentityLoginProps {
  className?: string;
}

export const IdentityLogin = ({ className = "" }: IdentityLoginProps) => {
  const { address } = useAccount();
  const { connectAsync, connectors, isPending: isConnecting } = useConnect();
  const { signTypedDataAsync, isPending: isSigning } = useSignTypedData({});
  const [session, setSession] = useState<Session | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSession = useCallback(async () => {
    setIsLoadingSession(true);
    try {
      setSession(await identityClient.getSession());
    } catch (sessionError) {
      console.error("identity_session_load_failed", sessionError);
      setSession(null);
    } finally {
      setIsLoadingSession(false);
    }
  }, []);

  useEffect(() => {
    void loadSession();
    window.addEventListener(IDENTITY_SESSION_CHANGED_EVENT, loadSession);
    return () => window.removeEventListener(IDENTITY_SESSION_CHANGED_EVENT, loadSession);
  }, [loadSession]);

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
        setSession(nextSession);
        notifyIdentitySessionChanged();
      } catch (loginError) {
        const message = loginError instanceof Error ? loginError.message : "Identity login failed";
        console.error("identity_login_failed", { error: message });
        setError(message);
      }
    },
    [address, connectAsync, connectors, signTypedDataAsync],
  );

  const isPending = isConnecting || isSigning || isLoadingSession;
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
        // not silently try the first one and fail when that extension is absent.
        <div className="flex gap-1">
          {connectors.map((connector) => (
            <Button
              key={connector.id}
              className="h-9 px-4"
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
