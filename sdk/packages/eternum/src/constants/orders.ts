import { IOrder } from "../types";

export const ORDER_NAME_DICT: { [key: number]: string } = {
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
  17: "gods",
};

export const orders: IOrder[] = [
  {
    orderId: 1,
    orderName: "Power",
    fullOrderName: "Order of Power",
    color: "#F4B547",
  },
  {
    orderId: 2,
    orderName: "Anger",
    fullOrderName: "Order of Anger",
    color: "#89192D",
  },
  {
    orderId: 3,
    orderName: "Brilliance",
    fullOrderName: "Order of Brilliance",
    color: "#7DFFBA",
  },
  {
    orderId: 4,
    orderName: "Detection",
    fullOrderName: "Order of Detection",
    color: "#139757",
  },
  {
    orderId: 5,
    orderName: "Enlightenment",
    fullOrderName: "Order of Enlightenment",
    color: "#1380FF",
  },
  {
    orderId: 6,
    orderName: "Fox",
    fullOrderName: "Order of the Fox",
    color: "#D47230",
  },
  {
    orderId: 7,
    orderName: "Fury",
    fullOrderName: "Order of Fury",
    color: "#82005E",
  },
  {
    orderId: 8,
    orderName: "Giants",
    fullOrderName: "Order of Giants",
    color: "#EB544D",
  },
  {
    orderId: 9,
    orderName: "Perfection",
    fullOrderName: "Order of Perfection",
    color: "#8E35FF",
  },
  {
    orderId: 10,
    orderName: "Reflection",
    fullOrderName: "Order of Reflection",
    color: "#00A2AA",
  },
  {
    orderId: 11,
    orderName: "Skill",
    fullOrderName: "Order of Skill",
    color: "#706DFF",
  },
  {
    orderId: 12,
    orderName: "Titans",
    fullOrderName: "Order of Titans",
    color: "#EC68A8",
  },
  {
    orderId: 13,
    orderName: "Twins",
    fullOrderName: "Order of the Twins",
    color: "#0020C6",
  },
  {
    orderId: 14,
    orderName: "Vitriol",
    fullOrderName: "Order of Vitriol",
    color: "#59A509",
  },
  {
    orderId: 15,
    orderName: "Rage",
    fullOrderName: "Order of Rage",
    color: "#C74800",
  },
  {
    orderId: 16,
    orderName: "Protection",
    fullOrderName: "Order of Protection",
    color: "#00C3A1",
  },
  {
    orderId: 17,
    orderName: "Gods",
    fullOrderName: "Order of the Gods",
    color: "#94a3b8",
  },
];

export function getOrderName(orderId: number): string {
  return orders[orderId - 1]?.orderName;
}
