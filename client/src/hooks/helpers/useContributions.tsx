import { useEntityQuery } from "@dojoengine/react";
import { useDojo } from "../context/DojoContext";
import { Component, Entity, HasValue, getComponentValue } from "@dojoengine/recs";
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

export const useContributions = (hyperstructureEntityId: bigint) => {
  const {
    setup: {
      components: {
        Contribution,
      },
    },
  } = useDojo();

  const contributionsToHyperstructure = useEntityQuery([HasValue(Contribution, { hyperstructure_entity_id: hyperstructureEntityId })]);

  return {
    contributionsToHyperstructure: () =>
        formatContributions(
            contributionsToHyperstructure,
            Contribution,
      ),
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
