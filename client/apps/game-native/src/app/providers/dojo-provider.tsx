import React, {createContext, useContext, useMemo} from 'react';
import {View} from 'react-native';

// Self-contained Dojo context that avoids importing @bibliothecadao/react
// and @bibliothecadao/dojo which require Node's `crypto` module.
// TODO: Once crypto polyfill or Torii native SDK is available, wire up real Dojo context.

interface DojoContextValue {
  masterAccount: null;
  account: {account: null; accountDisplay: string};
  isReady: boolean;
}

const DojoCtx = createContext<DojoContextValue>({
  masterAccount: null,
  account: {account: null, accountDisplay: ''},
  isReady: false,
});

export function DojoProvider({children}: {children: React.ReactNode}) {
  const value = useMemo(
    (): DojoContextValue => ({
      masterAccount: null,
      account: {account: null, accountDisplay: 'Mock'},
      isReady: true,
    }),
    [],
  );

  return <DojoCtx.Provider value={value}>{children}</DojoCtx.Provider>;
}

export function useDojo() {
  return useContext(DojoCtx);
}
