import { useCallback, useEffect, useState } from "react";

export const useCartridgeAddress = () => {
  const [address, setAddress] = useState<string | null>(null);
  const [searchId, setSearchId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState<string | null>(null);

  const fetchAddress = useCallback(async (id: string) => {
    setSearchId(id);
  }, []);

  useEffect(() => {
    const getAddress = async () => {
      if (!searchId) return;

      setLoading(true);
      try {
        const response = await fetch("https://api.cartridge.gg/lookup", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ usernames: [searchId] }),
        });

        const data = await response.json();
        console.log(data);

        if (data.results.length > 0) {
          setAddress(data.results[0].addresses[0]);
          setName(data.results[0].username);
        } else {
          setAddress(null);
          setName(null);
        }
      } catch (error) {
        console.error("Error fetching address:", error);
        setAddress(null);
      } finally {
        setLoading(false);
      }
    };

    getAddress();
  }, [searchId]);

  return { address, fetchAddress, loading };
};
