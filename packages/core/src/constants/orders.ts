import { IOrder } from "../types";

export const ORDER_NAME_DICT: { [key: number]: string } = {
  0: "gods",
  1: "giants",
  2: "perfection",
  3: "rage",
  4: "fox",
  5: "twins",
  6: "fury",
  7: "reflection",
  8: "detection",
  9: "skill",
  10: "brilliance",
  11: "protection",
  12: "power",
  13: "titans",
  14: "vitriol",
  15: "anger",
  16: "enlightenment",
};

export const orders: IOrder[] = [
  {
    orderId: 0,
    orderName: "gods",
    fullOrderName: "Order of Gods",
    color: "#94a3b8",
  },
  {
    orderId: 1,
    orderName: "Giants",
    fullOrderName: "Order of Giants",
    color: "#EB544D",
  },
  {
    orderId: 2,
    orderName: "Perfection",
    fullOrderName: "Order of Perfection",
    color: "#8E35FF",
  },
  {
    orderId: 3,
    orderName: "Rage",
    fullOrderName: "Order of Rage",
    color: "#C74800",
  },
  {
    orderId: 4,
    orderName: "Fox",
    fullOrderName: "Order of the Fox",
    color: "#D47230",
  },
  {
    orderId: 5,
    orderName: "Twins",
    fullOrderName: "Order of the Twins",
    color: "#0020C6",
  },
  {
    orderId: 6,
    orderName: "Fury",
    fullOrderName: "Order of Fury",
    color: "#82005E",
  },
  {
    orderId: 7,
    orderName: "Reflection",
    fullOrderName: "Order of Reflection",
    color: "#00A2AA",
  },
  {
    orderId: 8,
    orderName: "Detection",
    fullOrderName: "Order of Detection",
    color: "#139757",
  },
  {
    orderId: 9,
    orderName: "Skill",
    fullOrderName: "Order of Skill",
    color: "#706DFF",
  },
  {
    orderId: 10,
    orderName: "Brilliance",
    fullOrderName: "Order of Brilliance",
    color: "#7DFFBA",
  },
  {
    orderId: 11,
    orderName: "Protection",
    fullOrderName: "Order of Protection",
    color: "#00C3A1",
  },
  {
    orderId: 12,
    orderName: "Power",
    fullOrderName: "Order of Power",
    color: "#F4B547",
  },
  {
    orderId: 13,
    orderName: "Titans",
    fullOrderName: "Order of Titans",
    color: "#EC68A8",
  },
  {
    orderId: 14,
    orderName: "Vitriol",
    fullOrderName: "Order of Vitriol",
    color: "#59A509",
  },
  {
    orderId: 15,
    orderName: "Anger",
    fullOrderName: "Order of Anger",
    color: "#89192D",
  },
  {
    orderId: 16,
    orderName: "Enlightenment",
    fullOrderName: "Order of Enlightenment",
    color: "#1380FF",
  },
];

export function getOrderName(orderId: number): string {
  return orders[orderId - 1]?.orderName;
}
