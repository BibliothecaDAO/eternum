import { identityClient, notificationOwnerOf, useIdentitySession } from "@/hooks/context/identity-session";
import {
  activeBuildOrder,
  buildOrderBookValue,
  readBuildOrderBook,
  type BuildOrder,
  type BuildOrderBook,
} from "@bibliothecadao/eternum/automation";
import { useEffect } from "react";
import { create } from "zustand";

/**
 * The signed-in account's build orders, as its identity service keeps them: one copy, read when the account signs in
 * and replaced by what each save answers. Signed out, there are none, and the Build order panel follows the default.
 */
interface BuildOrderState {
  owner: string | null;
  status: "signed-out" | "loading" | "ready" | "saving" | "error";
  book: BuildOrderBook | null;
  revision: number;
  error: string | null;
}

export const useBuildOrderStore = create<BuildOrderState>(() => ({
  owner: null,
  status: "signed-out",
  book: null,
  revision: 0,
  error: null,
}));

/** Reads the account's book, once per account signed in. */
const loadBuildOrders = async (owner: string | null): Promise<void> => {
  const store = useBuildOrderStore;
  if (store.getState().owner === owner && store.getState().status !== "error") return;
  if (!owner) return store.setState({ owner, status: "signed-out", book: null, revision: 0, error: null });
  store.setState({ owner, status: "loading", book: null, revision: 0, error: null });
  try {
    accept(owner, await identityClient.getBuildOrders());
  } catch (error) {
    if (store.getState().owner === owner) store.setState({ status: "error", error: errorLine(error) });
  }
};

/** Saves a whole book over the revision last read; true once the account holds it. */
export const saveBuildOrders = async (book: BuildOrderBook): Promise<boolean> => {
  const store = useBuildOrderStore;
  const { owner, revision, status } = store.getState();
  if (!owner || (status !== "ready" && status !== "error")) return false;
  store.setState({ status: "saving", error: null });
  try {
    accept(owner, await identityClient.saveBuildOrders({ owner, revision, book: buildOrderBookValue(book) }));
    return true;
  } catch (error) {
    if (store.getState().owner === owner) store.setState({ status: "error", error: errorLine(error) });
    return false;
  }
};

/** What the service answered, read by the game's own reader; a book it cannot read is said, never half-shown. */
const accept = (owner: string, saved: { owner: string; revision: number; book: unknown }) => {
  if (useBuildOrderStore.getState().owner !== owner) return;
  const read = readBuildOrderBook(saved.book);
  if (saved.owner !== owner) throw new Error("Your account changed. Reload your build orders.");
  if ("error" in read) throw new Error(read.error);
  useBuildOrderStore.setState({ status: "ready", book: read.ok, revision: saved.revision, error: null });
};

const errorLine = (error: unknown): string =>
  error instanceof Error && error.message ? error.message : "Your build orders could not be reached.";

/** Keeps the store on whoever is signed in: mounted once, by the Build order panel. */
export const useBuildOrderAccount = (): void => {
  const { session } = useIdentitySession();
  const owner = notificationOwnerOf(session);
  useEffect(() => {
    void loadBuildOrders(owner);
  }, [owner]);
};

/** The account's build orders, as last read or saved. */
export const useBuildOrders = (): BuildOrderState => useBuildOrderStore();

/** The order the Build order panel follows: the account's active one, or the default. */
export const useActiveBuildOrder = (): BuildOrder => activeBuildOrder(useBuildOrderStore((state) => state.book));
