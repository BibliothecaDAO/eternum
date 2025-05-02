// import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
// import { BookOpen } from "lucide-react";
// import { BridgeIn } from "./bridge-in";
// import { BridgeOutStep1 } from "./bridge-out-step-1";
// import { BridgeOutStep2 } from "./bridge-out-step-2";

// export const SwapPanel = () => {
//   //useSyncPlayerRealms();
//   return (
//     <div>
//       <Tabs defaultValue="in">
//         <TabsList className="w-full">
//           <TabsTrigger className="w-full" value="in">
//             Bridge In
//           </TabsTrigger>
//           <TabsTrigger className="w-full" value="out-start">
//             Bridge Out
//           </TabsTrigger>
//           <TabsTrigger className="w-full" value="out-finish">
//             Bridge Out (Finish)
//           </TabsTrigger>
//         </TabsList>
//         <TabsContent className="border-2 rounded-xl border-opacity-15 round-tr-none" value="in">
//           <BridgeIn />
//         </TabsContent>
//         <TabsContent className="border-2 rounded-xl border-opacity-15 round-tr-none" value="out-start">
//           <BridgeOutStep1 />
//         </TabsContent>
//         <TabsContent className="border-2 rounded-xl border-opacity-15 round-tr-none" value="out-finish">
//           <BridgeOutStep2 />
//         </TabsContent>
//       </Tabs>
//       <div className="flex justify-end items-center mt-3 mr-1">
//         <a
//           href="https://eternum-docs.realms.world/overview/bridging"
//           target="_blank"
//           className="text-gold underline flex items-center text-sm"
//         >
//           Read Docs
//           <BookOpen className="w-4 h-4 ml-2" />
//         </a>
//       </div>
//     </div>
//   );
// };
