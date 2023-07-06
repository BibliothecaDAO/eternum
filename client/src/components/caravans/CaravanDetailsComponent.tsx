import React, { useEffect, useState } from 'react';
import { FilterButton } from '../../elements/FilterButton';
import { SecondaryPopup } from '../../elements/SecondaryPopup';
import { resources } from '../../constants/resources';
import { SelectBox } from '../../elements/SelectBox';
import { ResourceIcon } from '../../elements/ResourceIcon';
import { ReactComponent as CloseIcon } from '../../assets/icons/common/cross.svg';
import { ReactComponent as CaretDownFill } from '../../assets/icons/common/caret-down-fill.svg';
import Button from '../../elements/Button';
import { OrderIcon } from '../../elements/OrderIcon';
import { ResourceCost } from '../../elements/ResourceCost';
import { useComponentValue } from '@dojoengine/react';
import { Utils } from '@dojoengine/core';
import useBlockchainStore from '../../hooks/store/useBlockchainStore';
import { useDojo } from '../../DojoContext';
import useRealmStore from '../../hooks/store/useRealmStore';
import { getOrderIdsFromTrade, getTotalResourceWeight } from '../cityview/realm/trade/TradeUtils';
import { EntityIndex, getComponentValue } from '@latticexyz/recs';
import { getRealmIdByPosition, getRealmNameById, getRealmOrderNameById, getResourceIdsFromFungibleEntities } from '../cityview/realm/trade/TradeUtils';
import { Resource } from '../../types';

type CaravanDetailsProps = {
    tradeId: number;
    onClose: () => void;
}

export const CaravanDetails = ({ tradeId, onClose }: CaravanDetailsProps) => {
    const {realmEntityId} = useRealmStore();

    const {
        components: { Caravan, Capacity, Trade, ArrivalTime, FungibleEntities, Resource, Position },
    } = useDojo();

    const {nextBlockTimestamp} = useBlockchainStore();

    let trade = getComponentValue(Trade, Utils.getEntityIdFromKeys([BigInt(tradeId)]));
    const {realmOrderId, counterpartyOrderId} = (trade && realmEntityId !== undefined) && getOrderIdsFromTrade(trade, realmEntityId) || {realmOrderId: 0, counterpartyOrderId: 0};
    let arrivalTime = getComponentValue(ArrivalTime, Utils.getEntityIdFromKeys([BigInt(realmOrderId)]));

    let caravanID = getComponentValue(Caravan, Utils.getEntityIdFromKeys([BigInt(realmOrderId), BigInt(realmEntityId)]))?.caravan_id || 0;
    const fungibleEntitiesGive = getComponentValue(FungibleEntities, Utils.getEntityIdFromKeys([BigInt(realmOrderId)]));
    const fungibleEntitiesGet = getComponentValue(FungibleEntities, Utils.getEntityIdFromKeys([BigInt(counterpartyOrderId)]));

    let resourceEntityIdsGive = getResourceIdsFromFungibleEntities(realmOrderId, fungibleEntitiesGive?.key || 0, fungibleEntitiesGive?.count || 0);
    let resourceEntityIdsGet = getResourceIdsFromFungibleEntities(realmOrderId, fungibleEntitiesGet?.key || 0, fungibleEntitiesGet?.count || 0);
    let resourcesGive: Resource[] = [];
    for (let i = 0; i < resourceEntityIdsGive.length; i++) {
        resourcesGive.push(getComponentValue(Resource, resourceEntityIdsGive[i]) ?? {resource_type: 0, balance: 0});
    }
    let resourcesGet: Resource[] = [];
    for (let i = 0; i < resourceEntityIdsGet.length; i++) {
        resourcesGet.push(getComponentValue(Resource, resourceEntityIdsGet[i]) ?? {resource_type: 0, balance: 0});
    }

    // capacity
    let resourceWeight = getTotalResourceWeight([...resourcesGive, ...resourcesGet]);
    let caravanCapacity = getComponentValue(Capacity, Utils.getEntityIdFromKeys([BigInt(caravanID)]))?.weight_gram || 0;
      
    let position = useComponentValue(Position, Utils.getEntityIdFromKeys([BigInt(realmOrderId)]));

    const realmId = position && getRealmIdByPosition(position);
    const realmName = realmId && getRealmNameById(realmId);

    const isTravelling = nextBlockTimestamp && arrivalTime && (arrivalTime.arrives_at > nextBlockTimestamp);
    return (
        <SecondaryPopup>
            <SecondaryPopup.Head>
                <div className='flex items-center space-x-1'>
                    <div className='mr-0.5'>Caravan #{caravanID} {resourceWeight} / {caravanCapacity}</div>
                    <CloseIcon className="w-3 h-3 cursor-pointer fill-white" />
                </div>
            </SecondaryPopup.Head>
            <SecondaryPopup.Body>
                {isTravelling && realmName && <div className='flex items-center mt-2 ml-2 text-xxs'>
                    <span className='italic text-light-pink'>
                        Traveling to
                    </span>
                    <div className='flex items-center ml-1 mr-1 text-gold'>
                    <OrderIcon order={getRealmOrderNameById(realmId)} className='mr-1' size='xs' />
                        {realmName}
                    </div>
                    <span className='italic text-light-pink'>
                        with
                    </span>
                </div>}
                {resourcesGive && <div className='grid grid-cols-3 gap-2 px-2 py-1 mt-1'>
                    {resourcesGive.map((resource) => resource && <ResourceCost resourceId={resource.resource_type} amount={resource.balance} />)}
                </div>}
                <div className='flex items-center mt-3 ml-2 text-xxs'>
                    <span className='italic text-light-pink'>
                        You will get
                    </span>
                </div>
                {resourcesGet && <div className='grid grid-cols-3 gap-2 px-2 py-1'>
                {resourcesGet.map((resource) => resource && <ResourceCost resourceId={resource.resource_type} amount={resource.balance} />)}
                </div>}
                <div className='flex justify-start m-2'>
                    <Button onClick={onClose} variant='primary'>Close</Button>
                </div>
            </SecondaryPopup.Body>
        </SecondaryPopup >
    );
};