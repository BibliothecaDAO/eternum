import {
  identityClient,
  identityOrigin,
  useIdentitySession,
  useIdentitySessionStore,
} from "@/hooks/context/identity-session";
import Button from "@/ui/design-system/atoms/button";
import { IdentityRequestError, type SignInOptions } from "@realms-world/identity";
import { useConnect, useDisconnect, useProvider } from "@starknet-react/core";
import type { Connector } from "@starknet-react/core";
import { useCallback, useRef, useState } from "react";
import { addAddressPadding, constants, stark } from "starknet";

interface IdentityLoginProps {
  className?: string;
  /** "link" attaches a wallet to the signed-in Realms account; players never sign in with one. */
  mode?: "sign-in" | "link";
}

/** What the player asked for; each names its own failure. */
type IdentityAction = "create" | "passkey" | "recover" | "link";

/**
 * Sign-in is a Realms account: created with a passkey, or signed into with one. A wallet only links to an account,
 * except once for a player migrated with a linked wallet and no passkey, who proves the wallet and adds a passkey.
 */
export const IdentityLogin = ({ className = "", mode = "sign-in" }: IdentityLoginProps) => {
  const { status, session } = useIdentitySession();
  const applySession = useIdentitySessionStore((state) => state.applySession);
  const refresh = useIdentitySessionStore((state) => state.refresh);
  const { connectAsync, connectors, connector: connectedConnector } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const { provider } = useProvider();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRecovery, setShowRecovery] = useState(false);
  const running = useRef(false);

  const run = useCallback(async (action: IdentityAction, key: string, body: () => Promise<void>) => {
    if (running.current) return;
    running.current = true;
    setPending(key);
    setError(null);
    try {
      await body();
    } catch (cause) {
      console.error("identity_action_failed", { action, error: cause instanceof Error ? cause.message : cause });
      setError(failureSentence(action, cause));
    } finally {
      running.current = false;
      setPending(null);
    }
  }, []);

  const createAccount = () =>
    run("create", "create", async () => {
      await identityClient.signInAnonymously();
      try {
        await identityClient.registerPasskey();
      } finally {
        // An account whose passkey was cancelled still signs in; the account prompt asks it to add one.
        applySession(await identityClient.getSession().catch(() => null));
      }
    });

  const signInWithPasskey = () =>
    run("passkey", "passkey", async () => applySession(await identityClient.signInWithPasskey()));

  /** The wallet's proof as the identity service reads it, from the connector the player just chose. */
  const walletProof = useCallback(
    async (connector: Connector): Promise<SignInOptions> => {
      if (connectedConnector) await disconnectAsync();
      await connectAsync({ connector });
      if ((await connector.chainId()) !== BigInt(constants.StarknetChainId.SN_MAIN)) throw new WrongNetworkError();
      // Use the selected connector immediately; React's account state may still describe the previous wallet.
      const account = await connector.account(provider);
      return {
        address: addAddressPadding(account.address),
        chainId: "SN_MAIN",
        domain: window.location.host,
        uri: identityOrigin(),
        signTypedData: async (message) =>
          stark.formatSignature(await account.signMessage(message as Parameters<typeof account.signMessage>[0])),
      };
    },
    [connectAsync, connectedConnector, disconnectAsync, provider],
  );

  const linkWallet = (connector: Connector) =>
    run("link", connector.id, async () => {
      await identityClient.linkWallet(await walletProof(connector));
      await refresh();
    });

  // The recovered session is only for adding a passkey: without one, it ends here, and the player can try again.
  const recoverWithWallet = (connector: Connector) =>
    run("recover", connector.id, async () => {
      await identityClient.recoverWithWallet(await walletProof(connector));
      try {
        await identityClient.registerPasskey();
        applySession(await identityClient.signInWithPasskey());
      } catch (cause) {
        await identityClient.signOut().catch(() => undefined);
        applySession(null);
        throw cause;
      }
    });

  const busy = pending !== null || status === "loading";
  const walletButtons = (onChoose: (connector: Connector) => void) => (
    <>
      {connectors.map((connector) => (
        <Button
          key={connector.id}
          className="w-full !whitespace-normal px-4 py-2 leading-tight"
          disabled={busy}
          isLoading={pending === connector.id}
          onClick={() => onChoose(connector)}
        >
          {connector.name}
        </Button>
      ))}
      {connectors.length === 0 && <span className="text-xs text-gold/60">No Starknet wallets are available.</span>}
    </>
  );

  if (mode === "sign-in" && status === "signed-in" && session) return null;

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <div className="flex w-full flex-col gap-1">
        {mode === "link" ? (
          walletButtons((connector) => void linkWallet(connector))
        ) : (
          <>
            <Button
              className="w-full px-4 py-2"
              disabled={busy}
              isLoading={pending === "create"}
              onClick={() => void createAccount()}
            >
              Create a Realms account
            </Button>
            <Button
              className="w-full px-4 py-2"
              disabled={busy}
              isLoading={pending === "passkey"}
              onClick={() => void signInWithPasskey()}
            >
              Sign in with a passkey
            </Button>
            <button
              type="button"
              className="pt-1 text-left text-xs text-gold/60 underline"
              onClick={() => setShowRecovery((shown) => !shown)}
            >
              Existing player? Use your linked wallet once
            </button>
            {showRecovery ? (
              <>
                <span className="text-xs text-gold/60">
                  Your wallet proves the account once, then you add a passkey and sign in with it from now on.
                </span>
                {walletButtons((connector) => void recoverWithWallet(connector))}
              </>
            ) : null}
          </>
        )}
      </div>
      {error && <span className="max-w-[240px] text-xs text-danger">{error}</span>}
    </div>
  );
};

class WrongNetworkError extends Error {}

const NAMED_REFUSALS: Record<string, string> = {
  NO_LINKED_ACCOUNT: "This wallet is not linked to a Realms account.",
  RECOVERY_NOT_NEEDED: "This account already has a passkey. Sign in with it.",
  WALLET_LINKED_ELSEWHERE: "This wallet is linked to another Realms account.",
  WALLET_ALREADY_LINKED: "This account already has a linked wallet.",
};

const PASSKEY_REFUSED: Record<IdentityAction, string> = {
  create: "The passkey was not saved. Add one before you play.",
  passkey: "No passkey signed in. Try again, or create a Realms account.",
  recover: "Your account needs a passkey to finish. Try again.",
  link: "The wallet was not linked. Try again in a moment.",
};

const FALLBACK: Record<IdentityAction, string> = {
  create: "Your account was not created. Try again in a moment.",
  passkey: "Sign-in did not complete. Try again in a moment.",
  recover: "Your account was not recovered. Try again in a moment.",
  link: "The wallet was not linked. Try again in a moment.",
};

/** One sentence per failure the player can act on; the detail goes to the console. */
const failureSentence = (action: IdentityAction, cause: unknown): string => {
  const code = cause instanceof IdentityRequestError ? cause.code : undefined;
  if (code && NAMED_REFUSALS[code]) return NAMED_REFUSALS[code];
  if (cause instanceof WrongNetworkError) return "Switch this wallet to Starknet mainnet.";
  // A closed, timed-out or unanswered passkey prompt rejects with NotAllowedError.
  if (cause instanceof DOMException && cause.name === "NotAllowedError") return PASSKEY_REFUSED[action];
  return FALLBACK[action];
};
