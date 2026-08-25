/**
 * Hook to fetch and cache the user's username from the controller connector.
 * Converts the username to a felt value for use in contract calls.
 */
import { ControllerConnector } from "@cartridge/connector";
import { cairoShortStringToFelt } from "@dojoengine/torii-wasm";
import { useAccount } from "@starknet-react/core";
import { useEffect, useRef, useState } from "react";

interface UseUsernameReturn {
  /** Username as a felt string (hex) for contract calls */
  usernameFelt: string;
  /** Raw username string */
  username: string;
  /** Whether the username is still loading */
  isLoading: boolean;
}

export const useUsername = (): UseUsernameReturn => {
  const { connector, address } = useAccount();
  const [username, setUsername] = useState<string>("");
  const [usernameFelt, setUsernameFelt] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const fetchedForAddressRef = useRef<string | null>(null);

  useEffect(() => {
    if (!connector || !address) {
      setIsLoading(false);
      return;
    }

    // Skip if we already fetched for this address
    if (fetchedForAddressRef.current === address && usernameFelt) {
      setIsLoading(false);
      return;
    }

    const fetchUsername = async () => {
      setIsLoading(true);
      try {
        const controllerConnector = connector as unknown as ControllerConnector;
        const fetchedUsername = await controllerConnector?.username();

        if (fetchedUsername) {
          // Truncate to 31 chars (Cairo short string limit)
          const truncated = fetchedUsername.slice(0, 31);
          setUsername(truncated);
          setUsernameFelt(cairoShortStringToFelt(truncated));
          fetchedForAddressRef.current = address;
        } else {
          // Fallback: use truncated address as username
          const fallback = address.slice(0, 31);
          setUsername(fallback);
          setUsernameFelt(cairoShortStringToFelt(fallback));
          fetchedForAddressRef.current = address;
        }
      } catch {
        // Fallback on error
        const fallback = address.slice(0, 31);
        setUsername(fallback);
        setUsernameFelt(cairoShortStringToFelt(fallback));
        fetchedForAddressRef.current = address;
      } finally {
        setIsLoading(false);
      }
    };

    void fetchUsername();
  }, [connector, address, usernameFelt]);

  return {
    usernameFelt,
    username,
    isLoading,
  };
};
