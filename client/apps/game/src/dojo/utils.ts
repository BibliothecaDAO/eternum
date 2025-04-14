import { ContractComponents } from "@bibliothecadao/types";
import { Entity, getComponentValue } from "@dojoengine/recs";

// TODO: only workaround for now
export const handleExplorerTroopsIfDeletion = async (
  entityUpdate: any,
  components: ContractComponents,
  logging: boolean = false,
) => {
  for (const key of Object.keys(entityUpdate)) {
    for (const model of Object.keys(entityUpdate[key])) {
      if (logging) {
        console.log("key", key);
        console.log("model", model);
      }
      if (model === "s1_eternum-ExplorerTroops") {
        if (logging) {
          console.log("entityUpdate[key][model]", entityUpdate[key][model]);
        }
        if (Object.keys(entityUpdate[key][model]).length === 0) {
          const explorerComponent = getComponentValue(components.ExplorerTroops, key as Entity);
          if (logging) {
            console.log({ explorerComponent });
          }
          // Get the explorer schema type
          const explorer = {
            coord: {
              type: "struct",
              type_name: "Coord",
              value: {
                x: {
                  type: "primitive",
                  type_name: "u32",
                  value: 0,
                  key: false,
                },
                y: {
                  type: "primitive",
                  type_name: "u32",
                  value: 0,
                  key: false,
                },
              },
              key: false,
            },
            explorer_id: {
              type: "primitive",
              type_name: "u32",
              value: explorerComponent?.explorer_id || 0,
              key: true,
            },
            troops: {
              type: "struct",
              type_name: "Troops",
              value: {
                count: {
                  type: "primitive",
                  type_name: "u128",
                  value: "0x0000000000000000000000000000000000000000000000000000000000000000",
                  key: false,
                },
                category: {
                  type: "enum",
                  type_name: "TroopType",
                  value: {
                    option: "Crossbowman",
                    value: {
                      type: "tuple",
                      type_name: "()",
                      value: [],
                      key: false,
                    },
                  },
                  key: false,
                },
                stamina: {
                  type: "struct",
                  type_name: "Stamina",
                  value: {
                    amount: {
                      type: "primitive",
                      type_name: "u64",
                      value: "0x0000000000000000000000000000000000000000000000000000000000000000",
                      key: false,
                    },
                    updated_tick: {
                      type: "primitive",
                      type_name: "u64",
                      value: "0x0000000000000000000000000000000000000000000000000000000000000000",
                      key: false,
                    },
                  },
                  key: false,
                },
                tier: {
                  type: "enum",
                  type_name: "TroopTier",
                  value: {
                    option: "T1",
                    value: {
                      type: "tuple",
                      type_name: "()",
                      value: [],
                      key: false,
                    },
                  },
                  key: false,
                },
              },
              key: false,
            },
            owner: {
              type: "primitive",
              type_name: "u32",
              value: 0,
              key: false,
            },
          };
          entityUpdate[key][model] = explorer;
          if (logging) {
            console.log("entityUpdate[key][model]", entityUpdate[key][model]);
          }
        }
      }
    }
  }
};
