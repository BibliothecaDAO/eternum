export const orderNameDict: { [key: number]: string } = {
  1: "power",
  2: "anger",
  3: "brilliance",
  4: "detection",
  5: "enlightenment",
  6: "fox",
  7: "fury",
  8: "giants",
  9: "perfection",
  10: "reflection",
  11: "skill",
  12: "titans",
  13: "twins",
  14: "vitriol",
  15: "rage",
  16: "protection",
};
interface IOrder {
  orderId: number;
  orderName: string;
  fullOrderName: string;
}

export const orders: IOrder[] = [
  {
    orderId: 1,
    orderName: "Power",
    fullOrderName: "Order of Power",
  },
  {
    orderId: 2,
    orderName: "Anger",
    fullOrderName: "Order of Anger",
  },
  {
    orderId: 3,
    orderName: "Brilliance",
    fullOrderName: "Order of Brilliance",
  },
  {
    orderId: 4,
    orderName: "Detection",
    fullOrderName: "Order of Detection",
  },
  {
    orderId: 5,
    orderName: "Enlightenment",
    fullOrderName: "Order of Enlightenment",
  },
  {
    orderId: 6,
    orderName: "Fox",
    fullOrderName: "Order of the Fox",
  },
  {
    orderId: 7,
    orderName: "Fury",
    fullOrderName: "Order of Fury",
  },
  {
    orderId: 8,
    orderName: "Giants",
    fullOrderName: "Order of Giants",
  },
  {
    orderId: 9,
    orderName: "Perfection",
    fullOrderName: "Order of Perfection",
  },
  {
    orderId: 10,
    orderName: "Reflection",
    fullOrderName: "Order of Reflection",
  },
  {
    orderId: 11,
    orderName: "Skill",
    fullOrderName: "Order of Skill",
  },
  {
    orderId: 12,
    orderName: "Titans",
    fullOrderName: "Order of Titans",
  },
  {
    orderId: 13,
    orderName: "Twins",
    fullOrderName: "Order of the Twins",
  },
  {
    orderId: 14,
    orderName: "Vitriol",
    fullOrderName: "Order of Vitriol",
  },
  {
    orderId: 15,
    orderName: "Rage",
    fullOrderName: "Order of Rage",
  },
  {
    orderId: 16,
    orderName: "Protection",
    fullOrderName: "Order of Protection",
  },
];

export function getOrderName(orderId: number): string {
  return orders[orderId - 1].orderName;
}
