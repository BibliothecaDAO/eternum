import { identityClient, notificationOwnerOf, useIdentitySession } from "@/hooks/context/identity-session";
import { BUILD_ORDER_WORDS } from "@/ui/design-system/kit/words";
import { IdentityRequestError } from "@realms-world/identity";
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
 * The signed-in account's build orders, as its identity service keeps them: one copy, read when the account signs in,
 * read again when the player asks or another device saved first, and replaced by what each save answers. Signed out,
 * there are none, and the Build order panel follows the default.
 */
interface BuildOrderState {
  owner: string | null;
  /** "error": the last read or save failed, and the player may try it again. */
  status: "signed-out" | "loading" | "ready" | "saving" | "error";
  book: BuildOrderBook | null;
  revision: number;
  /** What the player must know about the last read or save: why it failed, or that the orders were read again. */
  notice: string | null;
}

export const useBuildOrderStore = create<BuildOrderState>(() => ({
  owner: null,
  status: "signed-out",
  book: null,
  revision: 0,
  notice: null,
}));

/** Starts on the account signed in: its book read once, none while signed out. */
const loadBuildOrders = async (owner: string | null): Promise<void> => {
  const store = useBuildOrderStore;
  if (store.getState().owner === owner) return;
  if (!owner) return store.setState({ owner, status: "signed-out", book: null, revision: 0, notice: null });
  store.setState({ owner, status: "loading", book: null, revision: 0, notice: null });
  await readBuildOrders(owner, null);
};

/** Reads the account's book again, as the player asks after a failure: what is on screen stays until it answers. */
export const reloadBuildOrders = async (): Promise<void> => {
  const { owner } = useBuildOrderStore.getState();
  if (owner) await readBuildOrders(owner, null);
};

/** Reads the book the service holds; `notice` says why it was read again, once it has been. */
const readBuildOrders = async (owner: string, notice: string | null): Promise<void> => {
  const store = useBuildOrderStore;
  store.setState({ status: "loading", notice: null });
  try {
    if (accept(owner, await identityClient.getBuildOrders())) store.setState({ notice });
  } catch (error) {
    if (store.getState().owner === owner) store.setState({ status: "error", notice: noticeOf(error) });
  }
};

/**
 * Saves a whole book over the revision last read; true once the account holds it. When another device saved first,
 * nothing is overwritten: the account's book is read again, and the player's next save goes over that one.
 */
export const saveBuildOrders = async (book: BuildOrderBook): Promise<boolean> => {
  const store = useBuildOrderStore;
  const { owner, revision, status } = store.getState();
  if (!owner || (status !== "ready" && status !== "error")) return false;
  store.setState({ status: "saving", notice: null });
  try {
    return accept(owner, await identityClient.saveBuildOrders({ owner, revision, book: buildOrderBookValue(book) }));
  } catch (error) {
    if (store.getState().owner !== owner) return false;
    if (isConflict(error)) await readBuildOrders(owner, BUILD_ORDER_WORDS.savedElsewhere);
    else store.setState({ status: "error", notice: noticeOf(error) });
    return false;
  }
};

/**
 * What the service answered, read by the game's own reader: true once it is the store's; a book it cannot read, or
 * another account's, is said and never half-shown.
 */
const accept = (owner: string, saved: { owner: string; revision: number; book: unknown }): boolean => {
  const store = useBuildOrderStore;
  if (store.getState().owner !== owner) return false;
  const refuse = (notice: string) => {
    store.setState({ status: "error", notice });
    return false;
  };
  if (saved.owner !== owner) return refuse(BUILD_ORDER_WORDS.accountChanged);
  const read = readBuildOrderBook(saved.book);
  if ("error" in read) return refuse(read.error);
  store.setState({ status: "ready", book: read.ok, revision: saved.revision, notice: null });
  return true;
};

const isConflict = (error: unknown): boolean => error instanceof IdentityRequestError && error.status === 409;

/**
 * A failed request in the player's words: the service's own reason where it gives one for them (an order it refused,
 * the account signed out or changed), else that the orders could not be reached; never a status code.
 */
const noticeOf = (error: unknown): string =>
  error instanceof IdentityRequestError && [400, 401, 403].includes(error.status) && error.message !== error.code
    ? error.message
    : BUILD_ORDER_WORDS.unreachable;

/**
 * Reads the account's book again when the player comes back to this tab: orders are made on the app's Build orders
 * page, which a game opens in a tab of its own, and on other devices. A read or save already under way is not doubled.
 */
const refreshBuildOrders = (): void => {
  const { owner, status } = useBuildOrderStore.getState();
  if (document.visibilityState !== "visible" || !owner || (status !== "ready" && status !== "error")) return;
  void readBuildOrders(owner, null);
};

/**
 * Keeps the store on whoever is signed in, and current when the player returns to the tab: mounted by every surface
 * that reads the orders (the Build order panel, Play's row, the Build orders page).
 */
export const useBuildOrderAccount = (): void => {
  const { session } = useIdentitySession();
  const owner = notificationOwnerOf(session);
  useEffect(() => {
    void loadBuildOrders(owner);
  }, [owner]);
  useEffect(() => {
    document.addEventListener("visibilitychange", refreshBuildOrders);
    window.addEventListener("focus", refreshBuildOrders);
    return () => {
      document.removeEventListener("visibilitychange", refreshBuildOrders);
      window.removeEventListener("focus", refreshBuildOrders);
    };
  }, []);
};

/** The account's build orders, as last read or saved. */
export const useBuildOrders = (): BuildOrderState => useBuildOrderStore();

/** The order the Build order panel follows: the account's active one, or the default. */
export const useActiveBuildOrder = (): BuildOrder => activeBuildOrder(useBuildOrderStore((state) => state.book));
