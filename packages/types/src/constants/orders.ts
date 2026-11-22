import type { AspectId, IOrder, OathJob } from "../types";

export const orders: IOrder[] = [
  {
    orderId: 0,
    aspect: null,
    oathJob: null,
    orderName: "gods",
    fullOrderName: "Order of Gods",
    color: "#94a3b8",
  },
  {
    orderId: 1,
    aspect: 1,
    oathJob: "fight",
    orderName: "Giants",
    fullOrderName: "Order of Giants",
    color: "#EB544D",
  },
  {
    orderId: 2,
    aspect: 2,
    oathJob: "prize",
    orderName: "Perfection",
    fullOrderName: "Order of Perfection",
    color: "#8E35FF",
  },
  {
    orderId: 3,
    aspect: 3,
    oathJob: "prize",
    orderName: "Rage",
    fullOrderName: "Order of Rage",
    color: "#C74800",
  },
  {
    orderId: 4,
    aspect: 4,
    oathJob: "stamina",
    orderName: "Fox",
    fullOrderName: "Order of the Fox",
    color: "#D47230",
  },
  {
    orderId: 5,
    aspect: 4,
    oathJob: "fight",
    orderName: "Twins",
    fullOrderName: "Order of the Twins",
    color: "#0020C6",
  },
  {
    orderId: 6,
    aspect: 3,
    oathJob: "stamina",
    orderName: "Fury",
    fullOrderName: "Order of Fury",
    color: "#82005E",
  },
  {
    orderId: 7,
    aspect: 4,
    oathJob: "prize",
    orderName: "Reflection",
    fullOrderName: "Order of Reflection",
    color: "#00A2AA",
  },
  {
    orderId: 8,
    aspect: 4,
    oathJob: "prize",
    orderName: "Detection",
    fullOrderName: "Order of Detection",
    color: "#139757",
  },
  {
    orderId: 9,
    aspect: 1,
    oathJob: "fight",
    orderName: "Skill",
    fullOrderName: "Order of Skill",
    color: "#706DFF",
  },
  {
    orderId: 10,
    aspect: 2,
    oathJob: "prize",
    orderName: "Brilliance",
    fullOrderName: "Order of Brilliance",
    color: "#7DFFBA",
  },
  {
    orderId: 11,
    aspect: 2,
    oathJob: "fight",
    orderName: "Protection",
    fullOrderName: "Order of Protection",
    color: "#00C3A1",
  },
  {
    orderId: 12,
    aspect: 1,
    oathJob: "fight",
    orderName: "Power",
    fullOrderName: "Order of Power",
    color: "#F4B547",
  },
  {
    orderId: 13,
    aspect: 1,
    oathJob: "stamina",
    orderName: "Titans",
    fullOrderName: "Order of Titans",
    color: "#EC68A8",
  },
  {
    orderId: 14,
    aspect: 3,
    oathJob: "fight",
    orderName: "Vitriol",
    fullOrderName: "Order of Vitriol",
    color: "#59A509",
  },
  {
    orderId: 15,
    aspect: 3,
    oathJob: "stamina",
    orderName: "Anger",
    fullOrderName: "Order of Anger",
    color: "#89192D",
  },
  {
    orderId: 16,
    aspect: 2,
    oathJob: "stamina",
    orderName: "Enlightenment",
    fullOrderName: "Order of Enlightenment",
    color: "#1380FF",
  },
];

export const catalogOrder = (orderId: number): IOrder => {
  const order = orders.find((candidate) => candidate.orderId === orderId);
  if (!order) throw new Error(`Unknown Order ${orderId}`);
  return order;
};

export const orderOathJob = (orderId: number): OathJob => {
  const order = catalogOrder(orderId);
  if (!order.oathJob) throw new Error(`Unknown Oath ${orderId}`);
  return order.oathJob;
};

export const orderAspect = (orderId: number): AspectId | null => catalogOrder(orderId).aspect;

export const aspects = [
  { id: 1, name: "Prowess" },
  { id: 2, name: "Luminary" },
  { id: 3, name: "Havoc" },
  { id: 4, name: "Insight" },
] as const satisfies readonly { id: AspectId; name: string }[];

export const ASPECT_REWARD = { lordsPerHeight: 10, finishBonus: 100_000, gloryToShare: 100 } as const;

export const aspectLordsWorth = (height: number, finishedFirst: boolean): number =>
  height * ASPECT_REWARD.lordsPerHeight + (finishedFirst ? ASPECT_REWARD.finishBonus : 0);

export const ordersOfAspect = (aspect: AspectId): IOrder[] => orders.filter((order) => order.aspect === aspect);

/** An Aspect of the catalog by its id; an id outside the catalog is a fault, never a blank. */
const catalogAspect = (aspect: number) => {
  const named = aspects.find(({ id }) => id === aspect);
  if (!named) throw new Error(`Unknown Aspect ${aspect}`);
  return named;
};

/** An Aspect's name by its id; throws outside the catalog. */
export const aspectName = (aspect: number): string => catalogAspect(aspect).name;

/** A number read from elsewhere (a link, a row) as the catalog's Aspect; throws outside the catalog. */
export const catalogAspectId = (aspect: number): AspectId => catalogAspect(aspect).id;
