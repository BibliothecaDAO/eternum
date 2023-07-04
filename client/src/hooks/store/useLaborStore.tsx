// TODO: figure out how to store the calculation results of Labor 
// and make them accessible everywhere

// import { useComponentValue } from "@dojoengine/react";
// import { useEffect } from "react";
// import { create } from "zustand";
// import useRealmStore from "./useRealmStore";
// import { useDojo } from "../../DojoContext";
// import { Utils } from "@dojoengine/core";
// import useBlockchainStore from "./useBlockchainStore";
// import { ResourcesIds } from "../../constants/resources";
// import { unpackResources } from "../../utils/packedData";

// export interface LaborState {
//   timeLeftToHarvest: { [resourceId: number]: number };
//   laborLeft: { [resourceId: number]: number };
//   nextHarvest: { [resourceId: number]: number };
//   laborCosts: { [resourceId: number]: { [resourceId: number]: number }[] };
//   setLaborState: () => void;
// }

// export const useLaborStore = create<LaborState>((set) => ({
//     timeLeftToHarvest: {},
//     laborLeft: {},
//     nextHarvest: {},
//     laborCosts: {},
//     setLaborState: () => {
//       set(() => ({
//         timeLeftToHarvest: {},
//         laborLeft: {},
//         nextHarvest: {},
//         laborCosts: {},
//       }));
  
//       const {
//         components: { Labor, Resource, Realm },
//       } = useDojo();
//       const { nextBlockTimestamp } = useBlockchainStore();
//       let realmEntityId = useRealmStore((state) => state.realmEntityId);
  
//       useEffect(() => {
//         let realm = useComponentValue(
//           Realm,
//           Utils.getEntityIdFromKeys([BigInt(realmEntityId)])
//         );
  
//         // unpack the resources
//         let resources: number[] = [ResourcesIds["Wheat"], ResourcesIds["Fish"]];
//         let unpackedResources: number[] = [];
  
//         if (realm) {
//           unpackedResources = unpackResources(
//             BigInt(realm.resource_types_packed),
//             realm.resource_types_count
//           );
//           resources = resources.concat(unpackedResources);
//         }
  
//         for (let resourceId of resources) {
//           let labor = useComponentValue(
//             Labor,
//             Utils.getEntityIdFromKeys([
//               BigInt(realmEntityId),
//               BigInt(resourceId),
//             ])
//           );
//           let resource = useComponentValue(
//             Resource,
//             Utils.getEntityIdFromKeys([
//               BigInt(realmEntityId),
//               BigInt(resourceId),
//             ])
//           );
  
//           // Update the state with the values
//           set(() => ({
//             timeLeftToHarvest: {
//               resourceId: nextBlockTimestamp,
//             },
//           }));
//           console.log("use effect");
//         }
//       }, [nextBlockTimestamp, realmEntityId]);
//     },
//   }));
  
  

// const LaborComponent = () => {
//   const { setLaborState } = useLaborStore();

//   useEffect(() => {
//     setLaborState();
//   }, []);

//   return null;
// };

// export default LaborComponent;
