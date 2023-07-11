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
    16: "protection"
};
interface IOrder {
    orderId: number,
    orderName: string
}

export const orders: IOrder[] = [
    {
        orderId: 1,
        orderName: 'Power'
    },
    {
        orderId: 2,
        orderName: 'Anger'
    },
    {
        orderId: 3,
        orderName: 'Brilliance'
    },
    {
        orderId: 4,
        orderName: 'Detection'
    },
    {
        orderId: 5,
        orderName: 'Enlightenment'
    },
    {
        orderId: 6,
        orderName: 'Fox'
    },
    {
        orderId: 7,
        orderName: 'Fury'
    },
    {
        orderId: 8,
        orderName: 'Giants'
    },
    {
        orderId: 9,
        orderName: 'Perfection'
    },
    {
        orderId: 10,
        orderName: 'Reflection'
    },
    {
        orderId: 11,
        orderName: 'Skill'
    },
    {
        orderId: 12,
        orderName: 'Titans'
    },
    {
        orderId: 13,
        orderName: 'Twins'
    },
    {
        orderId: 14,
        orderName: 'Vitriol'
    },
    {
        orderId: 15,
        orderName: 'Rage'
    },
    {
        orderId: 16,
        orderName: 'Protection'
    }
]

export function getOrderName(orderId: number): string {
    return orders[orderId - 1].orderName;
}