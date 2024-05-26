import { useDojo } from "../context/DojoContext";
import { Component, Entity, HasValue, getComponentValue, runQuery } from "@dojoengine/recs";
import { ClientComponents } from "@/dojo/createClientComponents";

export type Contribution = ClientComponents["Contribution"]["schema"];

const formatContributions = (contributions: Entity[], Contribution: Component): Contribution[] => {
  return contributions.map((id) => {
    const contribution = getComponentValue(Contribution, id) as ClientComponents["Contribution"]["schema"];

    return {
      ...contribution,
    };
  });
};

export const useContributions = () => {
  const {
    setup: {
      components: { Contribution },
    },
  } = useDojo();

  const getContributions = (hyperstructureEntityId: bigint) => {
    const contributionsToHyperstructure = Array.from(
      runQuery([HasValue(Contribution, { hyperstructure_entity_id: hyperstructureEntityId })]),
    );

    return formatContributions(contributionsToHyperstructure, Contribution);
  };

  return {
    getContributions,
  };
};

// export const useEntityArmies = ({ entity_id }: { entity_id: bigint }) => {
//   const {
//     setup: {
//       components: {
//         Position,
//         EntityOwner,
//         Owner,
//         Health,
//         Quantity,
//         Movable,
//         Capacity,
//         ArrivalTime,
//         Realm,
//         Army,
//         Protectee,
//         EntityName,
//       },
//     },
//   } = useDojo();

//   const armies = useEntityQuery([Has(Army), HasValue(EntityOwner, { entity_owner_id: entity_id })]);

//   return {
//     entityArmies: () =>
//       formatArmies(
//         armies,
//         Army,
//         Protectee,
//         EntityName,
//         Health,
//         Quantity,
//         Movable,
//         Capacity,
//         ArrivalTime,
//         Position,
//         EntityOwner,
//         Owner,
//         Realm,
//       ),
//   };
// };
