import realmsCoordsJson from '../../../../geodata/coords.json';
import realmsJson from '../../../../geodata/realms.json';
import realmsOrdersJson from '../../../../geodata/realms_raw.json';
import { orderNameDict } from '../../../../constants/orders';
import { Utils } from '@dojoengine/core';
import { EntityIndex } from '@latticexyz/recs';
import { Resource, Trade } from '../../../../types';

export const getRealmIdByPosition = (positionRaw: {x: number, y: number}): number | undefined => {
    let offset = 1800000;
    let position = {x: positionRaw.x - offset, y: positionRaw.y - offset};
    for (let realm of realmsCoordsJson['features'].slice(0,2)) {
        if (parseInt(realm['geometry']['coordinates'][0]) === position.x && parseInt(realm['geometry']['coordinates'][1]) === position.y) {
            return realm['properties']['tokenId'];
        }
    }
    return undefined;
}


export const getRealmNameById = (realmId: number): string | undefined => {
    for (let realm of realmsJson['features']) {
        if (realm['id'] === realmId) {
            return realm['name'];
        }
    }
    return undefined;
}

export const getRealmOrderNameById = (realmId: number): string => {
    const orderId = realmsOrdersJson[realmId - 1].id;
    return orderNameDict[orderId];
}   


export const getResourceIdsFromFungibleEntities = (orderId: number, key: number, count: number): EntityIndex[] => {
    return Array.from({length: count}, (_, i) => {
        return Utils.getEntityIdFromKeys([BigInt(orderId), BigInt(key), BigInt(i)])
    })
};

export const getOrderIdsFromTrade = (trade: Trade, realmEntityId: number): {realmOrderId: number, counterpartyOrderId: number} | undefined => {
    return trade.maker_id === realmEntityId? {realmOrderId: trade.maker_order_id, counterpartyOrderId: trade.taker_order_id}: trade.taker_id === realmEntityId? {realmOrderId: trade.taker_order_id, counterpartyOrderId: trade.maker_order_id}: undefined;
}


export const getTotalResourceWeight = (resources: (Resource | undefined)[]) => {
    return resources.reduce((total, resource) => total + (resource?.balance || 0) * 1, 0);
}