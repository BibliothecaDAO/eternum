// import { useQuery } from "@tanstack/react-query";
// import { useMemo } from "react";
// import { execute } from "./gql/execute";
// import {
//   GET_GAME_WINNER,
//   GET_HYPERSTRUCTURE_EPOCHS,
//   GET_LEADERBOARD,
//   GET_LEADERBOARD_ENTRY,
//   GET_PLAYER_HYPERSTRUCTURE_CONTRIBUTIONS,
// } from "./query/leaderboard";

// export const useLeaderboardEntry = (playerAddress: string) => {
//   const { data, isLoading } = useQuery({
//     queryKey: ["address", playerAddress],
//     queryFn: () => execute(GET_LEADERBOARD_ENTRY, { accountAddress: playerAddress }),
//     refetchInterval: 10_000,
//   });

//   const points = data?.s1EternumLeaderboardEntryModels?.edges?.[0]?.node?.points ?? 0;

//   return { points, isLoading };
// };

// export const useLeaderboardStatus = () => {
//   const { data, isLoading } = useQuery({
//     queryKey: ["leaderboard"],
//     queryFn: () => execute(GET_LEADERBOARD),
//     refetchInterval: 10_000,
//   });

//   const leaderboard = data?.s1EternumLeaderboardModels?.edges?.[0]?.node ?? null;

//   return { leaderboard, isLoading };
// };

// export const useGameWinner = () => {
//   const { data, isLoading } = useQuery({
//     queryKey: ["gameEnded"],
//     queryFn: () => execute(GET_GAME_WINNER),
//     refetchInterval: 10_000,
//   });

//   const winnerAddress = data?.s1EternumGameEndedModels?.edges?.[0]?.node?.winner_address ?? null;

//   return { winnerAddress, isLoading };
// };

// export const useGetPlayerHyperstructureContributions = (playerAddress: string) => {
//   const { data, isLoading } = useQuery({
//     queryKey: ["player_address", playerAddress],
//     queryFn: () => execute(GET_PLAYER_HYPERSTRUCTURE_CONTRIBUTIONS, { accountAddress: playerAddress }),
//     refetchInterval: 10_000,
//   });

//   const hyperstructures =
//     data?.s1EternumContributionModels?.edges?.map((edge) => edge?.node?.hyperstructure_entity_id) ?? ([] as number[]);

//   return { hyperstructures: [...new Set(hyperstructures)], isLoading };
// };

// export const useGetEpochs = (playerAddress: string) => {
//   // const { data, isLoading } = useQuery({
//   //   queryKey: ["epochs"],
//   //   queryFn: () => execute(GET_HYPERSTRUCTURE_EPOCHS),
//   //   refetchInterval: 10_000,
//   // });

//   const epochs = useMemo(() => {
//     // if (!data?.s1EternumEpochModels?.edges) return [];

//     // return data?.s1EternumEpochModels?.edges
//     //   ?.map((edge) => {
//     //     if (edge?.node?.owners?.find((owner) => owner?._0 === playerAddress)) {
//     //       return {
//     //         hyperstructure_entity_id: Number(edge?.node.hyperstructure_entity_id),
//     //         epoch: edge?.node.index,
//     //       };
//     //     }
//     //   })
//     //   .filter((epoch): epoch is { hyperstructure_entity_id: number; epoch: number } => epoch !== undefined);
//   }, [playerAddress]);

//   return { epochs };
// };
