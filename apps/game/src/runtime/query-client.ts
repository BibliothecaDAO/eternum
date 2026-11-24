import { QueryClient } from "@tanstack/react-query";
import { retryTransientRead } from "./app-api";

/** The app's one query cache: screens and the reads outside React share its entries, so a fact is fetched once. */
export const appQueryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, refetchOnReconnect: false, retry: retryTransientRead } },
});
