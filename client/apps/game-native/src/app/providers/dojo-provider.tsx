import React, {createContext, useContext, useMemo} from 'react';
import {Account, RpcProvider, AccountInterface} from 'starknet';
import {env} from '../config/env';
import {useStore} from '../../shared/store';

interface DojoContextValue {
  rpcProvider: RpcProvider;
  masterAccount: Account;
  account: Account | AccountInterface | null;
}

const DojoContext = createContext<DojoContextValue | null>(null);

export function DojoProvider({children}: {children: React.ReactNode}) {
  const account = useStore(s => s.account);

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

  return (
    <DojoContext.Provider value={{rpcProvider, masterAccount, account}}>
      {children}
    </DojoContext.Provider>
  );
}

export const useDojo = () => {
  const ctx = useContext(DojoContext);
  if (!ctx) {
    throw new Error('useDojo must be used within DojoProvider');
  }
  return ctx;
};
