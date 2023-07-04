  export const orderNameDict: { [key: number]: string } = {
    1: "power",
    2: "giants",
    3: "titans",
    4: "skill",
    5: "perfection",
    6: "brilliance",
    7: "enlightenment",
    8: "protection",
    9: "anger",
    10: "rage",
    11: "fury",
    12: "vitriol",
    13: "fox",
    14: "detection",
    15: "reflection",
    16: "twins"
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