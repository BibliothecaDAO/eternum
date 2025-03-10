import { create } from "zustand";

type AddressStore = {
  loading: boolean;
  addressName: undefined | string;
  setAddressName: (addressName: string | undefined) => void;
  setLoading: (loading: boolean) => void;
};

export const useAddressStore = create<AddressStore>((set) => ({
  loading: false,
  addressName: undefined,
  setAddressName: (addressName: string | undefined) => set({ addressName }),
  setLoading: (loading: boolean) => set({ loading }),
}));
