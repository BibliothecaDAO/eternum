import { useEffect, useState } from "react";
import { ControllerConnector } from "@cartridge/connector";
import { useAccount, useConnect } from "@starknet-react/core";

export interface UseCartridgeUsernameReturn {
  username: string | undefined;
  isLoading: boolean;
  address: string | undefined;
}

/**
 * Hook to load username from Cartridge controller
 * Handles async username resolution and loading states
 */
export function useCartridgeUsername(): UseCartridgeUsernameReturn {
  const { connectors } = useConnect();
  const { address } = useAccount();
  const [username, setUsername] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!address) {
      setUsername(undefined);
      setIsLoading(false);
      return;
    }

    const controller = connectors[0] as ControllerConnector;
    if (!controller) {
      setUsername(undefined);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    controller
      .username()
      ?.then((name) => {
        if (!cancelled && name) {
          setUsername(name);
        }
      })
      .catch((error) => {
        console.error("Failed to load controller username", error);
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    // Cleanup function to prevent race conditions
    return () => {
      cancelled = true;
    };
  }, [address, connectors]);

  return {
    username,
    isLoading,
    address,
  };
}
