import type { QueryClient } from "@tanstack/react-query";

export const WORLD_SUMMARY_QUERY_KEY = ["worldsSummary"] as const;
export const WORLD_AVAILABILITY_QUERY_KEY = ["worldAvailability"] as const;
export const PLAYER_WORLD_REGISTRATION_QUERY_KEY = ["playerWorldRegistration"] as const;

export function invalidateWorldListQueries(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: WORLD_SUMMARY_QUERY_KEY }),
    queryClient.invalidateQueries({ queryKey: WORLD_AVAILABILITY_QUERY_KEY }),
    queryClient.invalidateQueries({ queryKey: PLAYER_WORLD_REGISTRATION_QUERY_KEY }),
  ]);
}
