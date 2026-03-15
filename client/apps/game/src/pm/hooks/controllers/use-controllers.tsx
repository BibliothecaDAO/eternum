import { Controller } from "@dojoengine/torii-client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { BigNumberish } from "starknet";

import { normalizeAvatarAddress, normalizeAvatarUsername } from "@/hooks/use-player-avatar";
import { useDojoSdk } from "../dojo/use-dojo-sdk";

type ControllersProviderProps = {
  children: React.ReactNode;
};

type ControllersProviderState = {
  controllers?: Controller[];
  isLoading: boolean;
  refreshControllers: () => Promise<void>;
  findController: (address: BigNumberish) => Controller | undefined;
  findControllerByUsername: (username: string) => Controller | undefined;
  findControllerAddressByUsername: (username: string) => string | undefined;
};

const ControllersProviderContext = createContext<ControllersProviderState | undefined>(undefined);

export function ControllersProvider({ children, ...props }: ControllersProviderProps) {
  const { sdk } = useDojoSdk();
  const [controllers, setControllers] = useState<Controller[]>();
  const [isLoading, setIsLoading] = useState(false);

  const indexedControllers = useMemo(() => {
    const byAddress = new Map<string, Controller>();
    const byUsername = new Map<string, Controller>();
    const addressByUsername = new Map<string, string>();

    controllers?.forEach((controller) => {
      const normalizedAddress = normalizeAvatarAddress(controller.address);
      if (normalizedAddress) {
        byAddress.set(normalizedAddress, controller);
      }

      const normalizedUsername = normalizeAvatarUsername(controller.username);
      if (normalizedUsername && normalizedAddress) {
        byUsername.set(normalizedUsername, controller);
        addressByUsername.set(normalizedUsername, normalizedAddress);
      }
    });

    return { byAddress, byUsername, addressByUsername };
  }, [controllers]);

  const refreshControllers = useCallback(async () => {
    if (!sdk) return;

    setIsLoading(true);
    try {
      const res = await sdk.getControllers([], [], {
        cursor: undefined,
        direction: "Backward",
        limit: 50_000,
        order_by: [],
      });

      setControllers(res.items as Controller[]);
    } catch (error) {
      console.error("[controllers] Failed to load controllers", error);
    } finally {
      setIsLoading(false);
    }
  }, [sdk]);

  const findController = useCallback(
    (address: BigNumberish) => {
      const normalizedAddress = normalizeAvatarAddress(address as string | bigint | number | null | undefined);
      if (!normalizedAddress) return undefined;
      return indexedControllers.byAddress.get(normalizedAddress);
    },
    [indexedControllers.byAddress],
  );

  const findControllerByUsername = useCallback(
    (username: string) => {
      const normalizedUsername = normalizeAvatarUsername(username);
      if (!normalizedUsername) return undefined;
      return indexedControllers.byUsername.get(normalizedUsername);
    },
    [indexedControllers.byUsername],
  );

  const findControllerAddressByUsername = useCallback(
    (username: string) => {
      const normalizedUsername = normalizeAvatarUsername(username);
      if (!normalizedUsername) return undefined;
      return indexedControllers.addressByUsername.get(normalizedUsername);
    },
    [indexedControllers.addressByUsername],
  );

  useEffect(() => {
    void refreshControllers();
  }, [refreshControllers]);

  const value = useMemo(
    () => ({
      controllers,
      isLoading,
      refreshControllers,
      findController,
      findControllerByUsername,
      findControllerAddressByUsername,
    }),
    [
      controllers,
      findController,
      findControllerAddressByUsername,
      findControllerByUsername,
      isLoading,
      refreshControllers,
    ],
  );

  return (
    <ControllersProviderContext.Provider {...props} value={value}>
      {children}
    </ControllersProviderContext.Provider>
  );
}

export const useControllers = () => {
  const context = useContext(ControllersProviderContext);

  if (context === undefined) throw new Error("useControllers must be used within a ControllersProvider");

  return context;
};

export const useOptionalControllers = () => {
  return useContext(ControllersProviderContext);
};
