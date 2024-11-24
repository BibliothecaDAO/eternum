import {
  ActionExample,
  composeContext,
  generateObject,
  HandlerCallback,
  IAgentRuntime,
  Memory,
  ModelClass,
  State,
  type Action,
} from "@ai16z/eliza";

import { getStarknetAccount, getStarknetProvider, validateSettings } from "../utils";

import {
  BuildingType,
  Direction,
  EternumGlobalConfig,
  getDirectionBetweenAdjacentHexes,
  getNeighborHexes,
} from "@bibliothecadao/eternum";

import { gql, GraphQLClient } from "graphql-request";
import { CairoCustomEnum, Contract } from "starknet";

interface PlaceBuildingContent {
  buildingCategory: string;
}

export function isPlaceBuildingContent(content: PlaceBuildingContent): content is PlaceBuildingContent {
  // Validate types
  const validTypes = typeof content.buildingCategory === "string";
  if (!validTypes) {
    return false;
  }

  // Validate addresses (must be 32-bytes long with 0x prefix)
  const validBuildingCategory = Object.values(BuildingType)
    .filter((value) => typeof value === "string")
    .includes(content.buildingCategory);

  return validBuildingCategory;
}

const placeBuildingTemplate = `Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined.
These are the building categories you can place:
- None
- Castle
- Resource
- Farm
- FishingVillage
- Barracks
- Market
- ArcheryRange
- Stable
- TradingPost
- WorkersHut
- WatchTower
- Walls
- Storehouse

Example response:
\`\`\`json
{
    "buildingCategory": "Farm",
}
\`\`\`

{{recentMessages}}

Extract the following information about the requested building placement:
- Building category

Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined.`;

export const placeBuilding: Action = {
  name: "PLACE_BUILDING",
  similes: [
    "ETERNUM_BUILDING_PLACE",
    "ETERNUM_PLACE_BUILDING",
    "ETERNUM_BUILDING_PLACE",
    "ETERNUM_BUILD",
    "BUILD_ETERNUM",
  ],
  validate: async (runtime: IAgentRuntime, message: Memory) => {
    return validateSettings(runtime);
  },
  description:
    "Place a building in your realm. Use this action when a user asks you to place a building or consolidate your realm.",
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    _options: { [key: string]: unknown },
    callback?: HandlerCallback,
  ): Promise<unknown> => {
    if (!state) {
      state = (await runtime.composeState(message)) as State;
    } else {
      state = await runtime.updateRecentMessageState(state);
    }

    const placeBuildingContext = composeContext({
      state,
      template: placeBuildingTemplate,
    });

    const response: PlaceBuildingContent = await generateObject({
      runtime,
      context: placeBuildingContext,
      modelClass: ModelClass.MEDIUM,
    });

    console.log("Response:", response);

    if (!isPlaceBuildingContent(response)) {
      callback?.({
        text: "Invalid building placement content, please try again.",
      });
      return false;
    }
    try {
      const client = new GraphQLClient(runtime.getSetting("STARKNET_INDEXER_URL") || process.env.STARKNET_INDEXER_URL);
      const resources = await client.request<ResourceResult>(resourceQuery, {
        entityId: 62,
      });
      const positions = await client.request<PositionResult>(positionQuery, {
        entityId: 62,
      });
      const buildings = await client.request<BuildingResult>(buildingQuery, {
        outer_col: positions.eternumPositionModels.edges[0].node.x,
        outer_row: positions.eternumPositionModels.edges[0].node.y,
      });

      const buildingsParsed = buildings.eternumBuildingModels.edges.map((edge) => ({
        inner_col: edge.node.inner_col,
        inner_row: edge.node.inner_row,
      }));

      const resourcesParsed = resources.eternumResourceModels.edges.reduce(
        (acc, edge) => ({
          ...acc,
          [Number(edge.node.resource_type)]:
            Number(edge.node.balance) / EternumGlobalConfig.resources.resourcePrecision,
        }),
        {},
      );

      const neighboringHexes = getNeighborHexes(REALM_CENTER_POSITION.col, REALM_CENTER_POSITION.row);

      const emptyNeighborHexes = neighboringHexes.filter(
        (hex) => !buildingsParsed.some((building) => building.inner_col === hex.col && building.inner_row === hex.row),
      );

      //   const costs = EternumGlobalConfig.buildings.buildingCosts[response.buildingCategory];
      // fix this
      const costs = EternumGlobalConfig.buildings.buildingCosts[1];

      const canAfford = checkBalance(costs, resourcesParsed);
      if (!canAfford) {
        throw new Error("Cannot afford building.");
      }

      const buildingContractAddress = "0x36b82076142f07fbd8bf7b2cabf2e6b190082c0b242c6ecc5e14b2c96d1763c";
      const provider = getStarknetProvider(runtime);
      const account = getStarknetAccount(runtime);
      const { abi: buildingAbi } = await provider.getClassAt(buildingContractAddress);
      if (buildingAbi === undefined) {
        throw new Error("no abi.");
      }

      const buildingContract = new Contract(buildingAbi, buildingContractAddress, provider);

      buildingContract.connect(account);

      const direction = getDirectionBetweenAdjacentHexes(REALM_CENTER_POSITION, emptyNeighborHexes[0]);

      const buildingEnum = new CairoCustomEnum({
        None: response.buildingCategory === BuildingType[BuildingType.None] ? 0 : undefined,
        Castle: response.buildingCategory === BuildingType[BuildingType.Castle] ? 1 : undefined,
        Resource: response.buildingCategory === BuildingType[BuildingType.Resource] ? 2 : undefined,
        Farm: response.buildingCategory === BuildingType[BuildingType.Farm] ? 3 : undefined,
        FishingVillage: response.buildingCategory === BuildingType[BuildingType.FishingVillage] ? 4 : undefined,
        Barracks: response.buildingCategory === BuildingType[BuildingType.Barracks] ? 5 : undefined,
        Market: response.buildingCategory === BuildingType[BuildingType.Market] ? 6 : undefined,
        ArcheryRange: response.buildingCategory === BuildingType[BuildingType.ArcheryRange] ? 7 : undefined,
        Stable: response.buildingCategory === BuildingType[BuildingType.Stable] ? 8 : undefined,
        TradingPost: response.buildingCategory === BuildingType[BuildingType.TradingPost] ? 9 : undefined,
        WorkersHut: response.buildingCategory === BuildingType[BuildingType.WorkersHut] ? 10 : undefined,
        WatchTower: response.buildingCategory === BuildingType[BuildingType.WatchTower] ? 11 : undefined,
        Walls: response.buildingCategory === BuildingType[BuildingType.Walls] ? 12 : undefined,
        Storehouse: response.buildingCategory === BuildingType[BuildingType.Storehouse] ? 13 : undefined,
        Bank: response.buildingCategory === BuildingType[BuildingType.Bank] ? 14 : undefined,
        FragmentMine: response.buildingCategory === BuildingType[BuildingType.FragmentMine] ? 15 : undefined,
      });
      const directionEnum = new CairoCustomEnum({
        East: direction === Direction.EAST ? 0 : undefined,
        NorthEast: direction === Direction.NORTH_EAST ? 1 : undefined,
        NorthWest: direction === Direction.NORTH_WEST ? 2 : undefined,
        West: direction === Direction.WEST ? 3 : undefined,
        SouthWest: direction === Direction.SOUTH_WEST ? 4 : undefined,
        SouthEast: direction === Direction.SOUTH_EAST ? 5 : undefined,
      });
      const none = new CairoCustomEnum({ None: 0, Some: undefined });
      const call = await buildingContract.invoke("create", [62, [directionEnum], buildingEnum, none]);
      const result = await provider.waitForTransaction(call.transaction_hash);
      console.log(result);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  },
  examples: [
    [
      {
        user: "{{user1}}",
        content: {
          text: "Place a building in eternum",
        },
      },
      {
        user: "{{agent}}",
        content: {
          text: "Ok, I'll place a building",
        },
      },
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "Can you place a building in your realm please?",
        },
      },
      {
        user: "{{agent}}",
        content: {
          text: "Yeah, I'll place a building in my realm.",
        },
      },
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "I think you should probably build your base in Eternum",
        },
      },
      {
        user: "{{agent}}",
        content: {
          text: "Ok I'll place a building in my realm.",
        },
      },
      ``,
    ],
  ] as ActionExample[][],
} as Action;

const checkBalance = (cost: any, balances: { [key: number]: number }) =>
  Object.keys(cost).every((resourceId) => {
    const resourceCost = cost[Number(resourceId)];
    const balance = balances[resourceCost.resource];

    return balance >= resourceCost.amount * EternumGlobalConfig.resources.resourceMultiplier;
  });

const REALM_CENTER_POSITION = { col: 10, row: 10 };

interface ResourceResult {
  eternumResourceModels: {
    edges: Array<{
      node: {
        resource_type: string;
        balance: number;
      };
    }>;
  };
}

interface PositionResult {
  eternumPositionModels: {
    edges: Array<{
      node: {
        x: number;
        y: number;
      };
    }>;
  };
}

interface BuildingResult {
  eternumBuildingModels: {
    edges: Array<{
      node: {
        inner_col: number;
        inner_row: number;
      };
    }>;
  };
}

const resourceQuery = gql`
  query ResourceQuery($entityId: Int!) {
    eternumResourceModels(where: { entity_id: $entityId }, limit: 100) {
      edges {
        node {
          resource_type
          balance
        }
      }
    }
  }
`;

const positionQuery = gql`
  query PositionQuery($entityId: Int!) {
    eternumPositionModels(where: { entity_id: $entityId }) {
      edges {
        node {
          x
          y
        }
      }
    }
  }
`;

const buildingQuery = gql`
  query BuildingQuery($outer_col: Int!, $outer_row: Int!) {
    eternumBuildingModels(where: { outer_col: $outer_col, outer_row: $outer_row }) {
      edges {
        node {
          inner_col
          inner_row
        }
      }
    }
  }
`;
