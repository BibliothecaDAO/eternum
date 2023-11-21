import { create } from "zustand";
import { fetchAddressName } from "../graphql/useGraphQLQueries";
import { useEffect } from "react";
import { hexToAscii } from "../../utils/utils";

type AddressStore = {
  loading: boolean;
  addressName: undefined | string;
  setAddressName: (addressName: string) => void;
  setLoading: (loading: boolean) => void;
};

export const useAddressStore = create<AddressStore>((set) => ({
  loading: false,
  addressName: undefined,
  setAddressName: (addressName: string | undefined) => set({ addressName }),
  setLoading: (loading: boolean) => set({ loading }),
}));

export const useFetchAddressName = (address: string) => {
  const setAddressName = useAddressStore((state) => state.setAddressName);
  const setLoading = useAddressStore((state) => state.setLoading);
  useEffect(() => {
    const syncAddressName = async () => {
      const addressName = await fetchAddressName(address);
      if (addressName) {
        setAddressName(hexToAscii(addressName));
      } else {
        setAddressName(undefined);
      }
      setLoading(false);
    };
    syncAddressName();
  }, [address]);
};
