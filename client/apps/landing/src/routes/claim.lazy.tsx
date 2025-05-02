// import { Button } from "@/components/ui/button";
// import { useDojo } from "@/hooks/context/dojo-context";
// import {
//   useGameWinner,
//   useGetEpochs,
//   useGetPlayerHyperstructureContributions,
//   useLeaderboardEntry,
//   useLeaderboardStatus,
// } from "@/hooks/use-prize-claim";
// import { useAccount } from "@starknet-react/core";
// import { createLazyFileRoute } from "@tanstack/react-router";
// import { Loader2 } from "lucide-react";
// import { Suspense, useEffect, useState } from "react";

// const RegistrationCountdown = ({ registrationEnd }: { registrationEnd: string | undefined }) => {
//   const [timeLeft, setTimeLeft] = useState({ hours: "00", minutes: "00", seconds: "00" });

//   useEffect(() => {
//     if (!registrationEnd) return;

//     const timer = setInterval(() => {
//       const now = Math.floor(Date.now() / 1000);
//       const end = Number(registrationEnd);
//       if (now >= end) {
//         setTimeLeft({ hours: "00", minutes: "00", seconds: "00" });
//         clearInterval(timer);
//         return;
//       }

//       const diff = end - now;
//       const hours = Math.floor(diff / 3600);
//       const minutes = Math.floor((diff % 3600) / 60);
//       const seconds = diff % 60;
//       setTimeLeft({
//         hours: String(hours).padStart(2, "0"),
//         minutes: String(minutes).padStart(2, "0"),
//         seconds: String(seconds).padStart(2, "0"),
//       });
//     }, 1000);

//     return () => clearInterval(timer);
//   }, [registrationEnd]);

//   return (
//     <div className="bg-white/5 backdrop-blur-sm rounded-xl p-8 text-center">
//       <h2 className="text-2xl font-bold text-primary mb-4">Registration Countdown</h2>
//       <div className="text-3xl text-primary font-semibold">
//         {timeLeft.hours}:{timeLeft.minutes}:{timeLeft.seconds}
//       </div>
//     </div>
//   );
// };

// export const Route = createLazyFileRoute("/claim")({
//   component: Claim,
// });

// function Claim() {
//   const {
//     setup: {
//       // systemCalls: { claim_leaderboard_rewards, register_to_leaderboard },
//     },
//   } = useDojo();

//   const { account, address } = useAccount();

//   const [registerLoading, setRegisterLoading] = useState(false);
//   const [claimLoading, setClaimLoading] = useState(false);

//   const { points, isLoading: isPointsLoading } = useLeaderboardEntry(address || "");
//   const { leaderboard, isLoading: isLeaderboardLoading } = useLeaderboardStatus();
//   const { winnerAddress, isLoading: isWinnerLoading } = useGameWinner();

//   const hasRegistered = points > 0;

//   const registrationEnd = leaderboard?.registration_end_timestamp;
//   const isRegistrationPeriodActive = registrationEnd && Math.floor(Date.now() / 1000) < Number(registrationEnd);

//   const yourShare = Number(leaderboard?.total_points)
//     ? ((points / Number(leaderboard?.total_points)) * 100).toFixed(2)
//     : "0";

//   const { hyperstructures, isLoading: isHsLoading } = useGetPlayerHyperstructureContributions(address || "");
//   const { epochs, isLoading: isEpochsLoading } = useGetEpochs(address || "");

//   const loading = isPointsLoading || isLeaderboardLoading || isWinnerLoading || isHsLoading || isEpochsLoading;

//   const noPoints = hyperstructures.length === 0 && epochs.length === 0;

//   const onRegister = async () => {
//     if (!account || noPoints) return;
//     setRegisterLoading(true);
//     // todo: fix this
//     // await register_to_leaderboard({
//     //   signer: account,
//     //   hyperstructure_contributed_to: hyperstructures,
//     //   hyperstructure_shareholder_epochs: epochs,
//     // }).finally(() => setRegisterLoading(false));
//   };

//   const onClaim = async () => {
//     if (!account) return;
//     setClaimLoading(true);
//     // todo: fix this
//     // await claim_leaderboard_rewards({ signer: account, token: lordsAddress }).finally(() => setClaimLoading(false));
//   };

//   return (
//     <div className="flex flex-col h-full">
//       {loading && (
//         <div className="flex-grow flex items-center justify-center absolute inset-0 bg-background/50 z-50">
//           <Loader2 className="w-10 h-10 animate-spin" />
//         </div>
//       )}
//       <div className="flex-grow overflow-y-auto p-4">
//         <div className="flex flex-col gap-4">
//           <Suspense fallback={<div>Loading...</div>}>
//             <RegistrationCountdown registrationEnd={registrationEnd} />

//             <div className="bg-white/5 backdrop-blur-sm rounded-xl p-8">
//               <div className="flex flex-col gap-6">
//                 <div className="flex flex-col gap-3 items-center">
//                   <div className="p-6 rounded-lg bg-white/5 w-full max-w-md">
//                     <div className="space-y-4">
//                       <p className="text-lg flex justify-between">
//                         <span>Total Points Registred:</span>
//                         <span className="font-semibold">{Number(leaderboard?.total_points) || 0}</span>
//                       </p>

//                       {address && (
//                         <>
//                           <p className="text-lg flex justify-between">
//                             <span>Your Points:</span>
//                             <span className="font-semibold">{Number(points)}</span>
//                           </p>
//                           <p className="text-lg flex justify-between">
//                             <span>Your Share:</span>
//                             <span className="font-semibold">{yourShare}%</span>
//                           </p>
//                           {winnerAddress && (
//                             <p className="text-lg break-all">
//                               <span>Winner:</span>
//                               <br />
//                               <span className="font-mono text-sm">{winnerAddress}</span>
//                             </p>
//                           )}
//                         </>
//                       )}
//                     </div>
//                     {address && (
//                       <div className="flex flex-col gap-4 mt-6 pt-6 border-t border-gold/15">
//                         {noPoints ? (
//                           <p className="text-red-400 text-center">You have no points to register or claim</p>
//                         ) : (
//                           <>
//                             <Button
//                               variant="cta"
//                               className="w-full"
//                               disabled={hasRegistered || registerLoading || !winnerAddress}
//                               onClick={onRegister}
//                             >
//                               {registerLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Register"}
//                             </Button>
//                             <Button
//                               variant="default"
//                               className="w-full"
//                               disabled={points === 0 || claimLoading || !winnerAddress || isRegistrationPeriodActive}
//                               onClick={onClaim}
//                             >
//                               {claimLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Claim Rewards"}
//                             </Button>
//                           </>
//                         )}
//                       </div>
//                     )}
//                   </div>
//                 </div>
//               </div>
//             </div>
//           </Suspense>
//         </div>
//       </div>
//     </div>
//   );
// }
