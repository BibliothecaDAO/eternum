import { identityClient, useIdentitySessionStore } from "@/hooks/context/identity-session";

/** The lab account's saved build orders, shared by the app and game routes. */
export const answerLabBuildOrders = () => {
  let orders = { revision: 3, book: LAB_BUILD_ORDERS as unknown };
  const read = () => ({ owner: useIdentitySessionStore.getState().session?.user.realmsId ?? "", ...orders });
  identityClient.getBuildOrders = async () => read();
  identityClient.saveBuildOrders = async ({ book }) => {
    orders = { revision: orders.revision + 1, book };
    return read();
  };
};

/** Three orders a player saved, Coal rush the one followed. */
const LAB_BUILD_ORDERS = {
  active: "coal-rush",
  orders: [
    {
      id: "coal-rush",
      order: {
        name: "Coal rush",
        steps: [
          { rank: "Settlement", goal: "farm", count: 2 },
          { rank: "Settlement", goal: "levelUp" },
          { rank: "City", goal: "coal", count: 2 },
          { rank: "City", goal: "copper", count: 2 },
          { rank: "City", goal: "barracks", count: 1 },
          { rank: "City", goal: "levelUp" },
          { rank: "Kingdom", goal: "army", count: 1 },
          { rank: "Kingdom", goal: "farm", count: 4 },
          { rank: "Empire", goal: "army", count: 3 },
        ],
      },
    },
    {
      id: "wood-first",
      order: {
        name: "Wood first",
        steps: [
          { rank: "Settlement", goal: "wood", count: 2 },
          { rank: "City", goal: "farm", count: 4 },
        ],
      },
    },
    {
      id: "early-army",
      order: {
        name: "Early army",
        steps: [
          { rank: "Settlement", goal: "barracks", count: 1 },
          { rank: "Settlement", goal: "army", count: 1 },
        ],
      },
    },
  ],
};
