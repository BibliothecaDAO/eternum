import React, {createContext, useContext, useEffect, useMemo, useState} from 'react';
import {ActivityIndicator, StyleSheet, Text, View} from 'react-native';
import {Account, RpcProvider, AccountInterface} from 'starknet';
import {env} from '../config/env';
import {useStore} from '../../shared/store';
import {setup, SetupResult} from '@bibliothecadao/dojo';
import {DojoContext, DojoAccount} from '@bibliothecadao/react';

// Minimal dojo config built from env values
const dojoConfig = {
  rpcUrl: env.VITE_PUBLIC_NODE_URL,
  toriiUrl: env.VITE_PUBLIC_TORII,
  masterAddress: env.VITE_PUBLIC_MASTER_ADDRESS,
  masterPrivateKey: env.VITE_PUBLIC_MASTER_PRIVATE_KEY,
  accountClassHash: env.VITE_PUBLIC_ACCOUNT_CLASS_HASH,
  feeTokenAddress: env.VITE_PUBLIC_FEE_TOKEN_ADDRESS,
  manifest: {world: {address: ''}, contracts: []},
};

const NULL_ACCOUNT = {address: '0x0', privateKey: '0x0'} as const;

function displayAddress(address: string): string {
  if (!address || address.length < 10) {
    return address || '';
  }
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function DojoProvider({children}: {children: React.ReactNode}) {
  const account = useStore(s => s.account);
  const [setupResult, setSetupResult] = useState<SetupResult | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);

  const rpcProvider = useMemo(
    () => new RpcProvider({nodeUrl: env.VITE_PUBLIC_NODE_URL}),
    [],
  );

  const masterAccount = useMemo(
    () =>
      new Account({
        provider: rpcProvider,
        address: env.VITE_PUBLIC_MASTER_ADDRESS,
        signer: env.VITE_PUBLIC_MASTER_PRIVATE_KEY,
      }),
    [rpcProvider],
  );

  useEffect(() => {
    let cancelled = false;

    async function initDojo() {
      try {
        const result = await setup(dojoConfig as any, {
          vrfProviderAddress: env.VITE_PUBLIC_VRF_PROVIDER_ADDRESS,
          useBurner: false,
        });
        if (!cancelled) {
          setSetupResult(result);
        }
      } catch (err) {
        console.warn('[DojoProvider] setup() failed, running in fallback mode:', err);
        if (!cancelled) {
          setSetupError(String(err));
        }
      }
    }

    initDojo();
    return () => {
      cancelled = true;
    };
  }, []);

  // Build the account object for the Dojo context
  const accountToUse = useMemo((): Account | AccountInterface => {
    if (account) {
      return account;
    }
    return new Account({
      provider: rpcProvider,
      address: NULL_ACCOUNT.address,
      signer: NULL_ACCOUNT.privateKey,
    });
  }, [account, rpcProvider]);

  const dojoAccount = useMemo(
    (): DojoAccount => ({
      account: accountToUse,
      accountDisplay: displayAddress(
        (accountToUse as Account | AccountInterface)?.address || '',
      ),
    }),
    [accountToUse],
  );

  // If setup succeeded, provide the full Dojo context
  if (setupResult) {
    return (
      <DojoContext.Provider
        value={{
          ...setupResult,
          masterAccount,
          account: dojoAccount,
        }}>
        {children as any}
      </DojoContext.Provider>
    );
  }

  // If setup errored, still render children with a fallback context
  // so the app is usable with mock data during development
  if (setupError) {
    return (
      <DojoFallbackContext.Provider
        value={{rpcProvider, masterAccount, account: accountToUse}}>
        {children}
      </DojoFallbackContext.Provider>
    );
  }

  // Loading state
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color="#D4CDBE" />
      <Text style={styles.loadingText}>Connecting to Eternum...</Text>
    </View>
  );
}

// Fallback context for when Dojo setup fails (e.g., Torii WASM not available in Hermes)
interface DojoFallbackContextValue {
  rpcProvider: RpcProvider;
  masterAccount: Account;
  account: Account | AccountInterface;
}

const DojoFallbackContext = createContext<DojoFallbackContextValue | null>(null);

export const useDojoFallback = () => {
  const ctx = useContext(DojoFallbackContext);
  if (!ctx) {
    throw new Error('useDojoFallback must be used within DojoProvider fallback');
  }
  return ctx;
};

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2D2520',
    gap: 16,
  },
  loadingText: {
    color: '#D4CDBE',
    fontSize: 15,
  },
});
