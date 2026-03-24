/**
 * Refreshes the Cartridge Controller session policies without a page reload.
 *
 * The ControllerConnector bakes policies into its keychain iframe URL at
 * construction time. When a player selects a different game (different
 * contract addresses), we need to recreate the keychain iframe with
 * updated policies.
 *
 * This works by:
 * 1. Updating the controller's internal options.policies
 * 2. Destroying the old keychain iframe + Penpal connection
 * 3. Calling createKeychainIframe() to build a new one with correct policies
 * 4. Waiting for the new keychain to become ready
 * 5. Re-probing to restore the account from the keychain's auth storage
 *
 * The user stays authenticated because the keychain stores auth state in
 * its own origin's localStorage, not in the parent frame.
 */
import { dojoConfig } from "../../../dojo-config";
import { env } from "../../../env";
import { areSameRpcUrlSets, resolveControllerNetworkConfig } from "./controller-chain-config";
import { buildPolicies } from "./policies";

/**
 * Policy fingerprint. Starts empty since the connector is created
 * without policies (session deferred until game selection).
 */
let _lastPolicyHash = "";
let _isRefreshingPolicies = false;

function hashPolicies(manifest: unknown): string {
  try {
    return JSON.stringify(buildPolicies(manifest));
  } catch {
    return "";
  }
}

/**
 * Check if dojoConfig.manifest policies differ from the last known state.
 */
const hasPoliciesChanged = (): boolean => {
  return hashPolicies(dojoConfig.manifest) !== _lastPolicyHash;
};

export const isSessionPolicyRefreshInProgress = (): boolean => _isRefreshingPolicies;

type ControllerLikeProvider = {
  options?: {
    policies?: unknown;
    chains?: Array<{ rpcUrl?: string }>;
    defaultChainId?: string;
  };
  account?: unknown;
  iframes?: {
    keychain?: {
      container?: {
        parentNode?: {
          removeChild: (child: unknown) => void;
        };
      };
    };
  };
  keychain?: unknown;
  createKeychainIframe?: () => unknown;
  waitForKeychain?: (args: { timeout: number }) => Promise<void>;
  probe?: () => Promise<void>;
};

type ControllerNetworkRefreshPlan = {
  shouldUpdateChainConfig: boolean;
  nextDefaultChainId: string;
  nextRpcUrls: string[];
};

const getProviderRpcUrls = (provider: ControllerLikeProvider): string[] => {
  return (provider.options?.chains ?? [])
    .map((chain) => chain.rpcUrl?.trim() ?? "")
    .filter((value) => value.length > 0);
};

const resolveControllerNetworkRefreshPlan = (provider: ControllerLikeProvider): ControllerNetworkRefreshPlan => {
  const networkConfig = resolveControllerNetworkConfig({
    configuredChain: env.VITE_PUBLIC_CHAIN,
    rpcUrl: dojoConfig.rpcUrl ?? env.VITE_PUBLIC_NODE_URL,
    cartridgeApiBase: env.VITE_PUBLIC_CARTRIDGE_API_BASE,
    existingRpcUrls: getProviderRpcUrls(provider),
  });

  const currentDefaultChainId = provider.options?.defaultChainId ?? "";
  const currentRpcUrls = getProviderRpcUrls(provider);
  const nextRpcUrls = networkConfig.supportedRpcUrls;
  const nextDefaultChainId = networkConfig.resolvedChain.chainId;

  return {
    shouldUpdateChainConfig:
      currentDefaultChainId !== nextDefaultChainId || !areSameRpcUrlSets(currentRpcUrls, nextRpcUrls),
    nextDefaultChainId,
    nextRpcUrls,
  };
};

/**
 * Refresh the controller's session policies in-place and recreate the
 * keychain iframe. Call this after bootstrapGame() has patched dojoConfig.manifest.
 *
 * @param connector - The ControllerConnector instance
 * @returns true if policies were updated, false if no change needed
 */
export const refreshSessionPolicies = async (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  connector: any,
): Promise<boolean> => {
  const provider = (connector.controller ?? connector) as ControllerLikeProvider;

  // 1. Update policies in the controller's options
  if (!provider.options) {
    return false;
  }

  const hasPolicyChanges = hasPoliciesChanged();
  const networkRefreshPlan = resolveControllerNetworkRefreshPlan(provider);
  if (!hasPolicyChanges && !networkRefreshPlan.shouldUpdateChainConfig) {
    return false;
  }

  _isRefreshingPolicies = true;
  try {
    if (hasPolicyChanges) {
      provider.options.policies = buildPolicies(dojoConfig.manifest);
    }

    if (networkRefreshPlan.shouldUpdateChainConfig) {
      provider.options.chains = networkRefreshPlan.nextRpcUrls.map((rpcUrl) => ({ rpcUrl }));
      provider.options.defaultChainId = networkRefreshPlan.nextDefaultChainId;
    }

    // Keep the account object stable while we rotate the keychain iframe.
    // This prevents transient "disconnect" state during bootstrap.
    const previousAccount = provider.account;

    // 2. Destroy the old keychain iframe
    if (provider.iframes?.keychain) {
      const keychainIframe = provider.iframes.keychain;

      // Remove the DOM elements
      if (keychainIframe.container?.parentNode) {
        keychainIframe.container.parentNode.removeChild(keychainIframe.container);
      }

      // Remove viewport meta tag injected by the iframe base class
      const meta = document.getElementById("controller-viewport");
      if (meta) {
        meta.remove();
      }

      // Clear the iframe reference
      provider.iframes.keychain = undefined;
    }

    // 3. Clear only the keychain RPC connection
    provider.keychain = undefined;

    // 4. Create a fresh keychain iframe with updated policies
    //    createKeychainIframe reads from this.options (now updated)
    if (provider.createKeychainIframe && provider.iframes) {
      provider.iframes.keychain = provider.createKeychainIframe();
    }

    // 5. Wait for the new keychain to be ready, then re-probe
    if (provider.waitForKeychain) {
      try {
        await provider.waitForKeychain({ timeout: 10000 });
      } catch {
        // Timeout — keychain may still load eventually
      }
    }

    // 6. Re-probe to refresh account/session state from keychain
    if (provider.probe) {
      try {
        await provider.probe();
      } catch {
        // probe may fail if no prior session — that's OK
      }
    }

    if (!provider.account && previousAccount) {
      provider.account = previousAccount;
    }

    // 7. Update hash
    if (hasPolicyChanges) {
      _lastPolicyHash = hashPolicies(dojoConfig.manifest);
    }

    return true;
  } finally {
    _isRefreshingPolicies = false;
  }
};
