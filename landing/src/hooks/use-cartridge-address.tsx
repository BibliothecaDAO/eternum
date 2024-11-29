import { useCallback, useEffect, useState } from "react";

export const useCartridgeAddress = () => {
  const [address, setAddress] = useState<string | null>(null);
  const [searchId, setSearchId] = useState<string>("");

  const fetchAddress = useCallback(async (id: string) => {
    setSearchId(id);
  }, []);

  useEffect(() => {
    const getAddress = async () => {
      if (!searchId) return;

      try {
        const response = await fetch("https://api.cartridge.gg/query", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: `
              query Account {
                account(id: "${searchId}") {
                  controllers {
                    edges {
                      node {
                        address
                      }
                    }
                  }
                }
              }
            `,
          }),
        });

        const data = await response.json();
        const controllerAddress = data?.data?.account?.controllers?.edges?.[0]?.node?.address;
        setAddress(controllerAddress);
      } catch (error) {
        console.error("Error fetching address:", error);
        setAddress(null);
      }
    };

    getAddress();
  }, [searchId]);

  return { address, fetchAddress };
};
