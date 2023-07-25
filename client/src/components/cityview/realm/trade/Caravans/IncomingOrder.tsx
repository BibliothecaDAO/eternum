import React, { useEffect, useState } from 'react';
import { OrderIcon } from '../../../../../elements/OrderIcon';
import Button from '../../../../../elements/Button';
import { ResourceIcon } from '../../../../../elements/ResourceIcon';
import { findResourceById } from '../../../../../constants/resources';
import { ReactComponent as Pen } from '../../../../../assets/icons/common/pen.svg';
import { ReactComponent as Clock } from '../../../../../assets/icons/common/clock.svg';
import { ReactComponent as CaretDownFill } from '../../../../../assets/icons/common/caret-down-fill.svg';
import { ReactComponent as DonkeyIcon } from '../../../../../assets/icons/units/donkey.svg';
import { ReactComponent as PremiumIcon } from '../../../../../assets/icons/units/premium.svg';


import ProgressBar from '../../../../../elements/ProgressBar';
import { Dot } from '../../../../../elements/Dot';
import clsx from 'clsx';
import { useDojo } from '../../../../../DojoContext';
import { CaravanMember, Resource, ResourcesOffer, Trade } from '../../../../../types';
import { useComponentValue } from '@dojoengine/react';
import { Utils } from '@dojoengine/core';
import useRealmStore from '../../../../../hooks/store/useRealmStore';
import useBlockchainStore from '../../../../../hooks/store/useBlockchainStore';
import { formatSecondsLeftInDaysHours } from '../../labor/laborUtils';
import { getOrderIdsFromTrade, getRealmIdByPosition, getRealmNameById, getRealmOrderNameById, getResourceIdsFromFungibleEntities, getTotalResourceWeight } from '../TradeUtils';
import { getComponentValue } from '@latticexyz/recs';
import { useGetTradeFromCaravanId } from '../../../../../hooks/useGraphQLQueries';
import { ResourceCost } from '../../../../../elements/ResourceCost';
import { Order } from '../../RealmTradeComponent';

type IncomingOrderProps = {
    order: Order;
} & React.HTMLAttributes<HTMLDivElement>;

export const IncomingOrder = ({ order, ...props }: IncomingOrderProps) => {
    const { realmEntityId } = useRealmStore();
    const [isLoading, setIsLoading] = useState(false);

    const {
        systemCalls: { claim_fungible_order },
        components: { ArrivalTime, FungibleEntities, Resource, Position },
    } = useDojo();

    useEffect(() => {
        setIsLoading(false);
    }, [order.tradeId])

    const claimOrder = async () => {
        setIsLoading(true);
        claim_fungible_order({ entity_id: realmEntityId, trade_id: order.tradeId });
    }

    const { nextBlockTimestamp } = useBlockchainStore();

    // total 3 calls

    // 1 call
    let arrivalTime = getComponentValue(ArrivalTime, Utils.getEntityIdFromKeys([BigInt(order.orderId)]));

    // 1 call
    const fungibleEntitiesGet = getComponentValue(FungibleEntities, Utils.getEntityIdFromKeys([BigInt(order.orderId)]));
    let resourceEntityIdsGet = getResourceIdsFromFungibleEntities(order.orderId, fungibleEntitiesGet?.key || 0, fungibleEntitiesGet?.count || 0);
    let resourcesGet: Resource[] = [];
    for (let i = 0; i < resourceEntityIdsGet.length; i++) {
        resourcesGet.push(getComponentValue(Resource, resourceEntityIdsGet[i]) ?? { resource_type: 0, balance: 0 });
    }

    // 1 call
    const startPosition = getComponentValue(Position, Utils.getEntityIdFromKeys([BigInt(order.counterpartyOrderId)]));
    const startRealmId = startPosition && getRealmIdByPosition({ x: startPosition.x, y: startPosition.y })
    const startRealmName = startRealmId && getRealmNameById(startRealmId);
    const hasArrived = (arrivalTime !== undefined) && (nextBlockTimestamp !== undefined) && arrivalTime.arrives_at <= nextBlockTimestamp;

    return (
        <div className={clsx('flex flex-col p-2 border rounded-md border-gray-gold text-xxs text-gray-gold', props.className)} onClick={props.onClick}>
                {!hasArrived && startRealmName && <div className='flex items-center ml-1 -mt-2'>
                    <span className='italic text-light-pink'>
                        Traveling from
                    </span>
                    <div className='flex items-center ml-1 mr-1 text-gold'>
                        <OrderIcon order={getRealmOrderNameById(startRealmId)} className='mr-1' size='xs' />
                        {startRealmName}
                    </div>
                    <span className='italic text-light-pink'>
                    </span>
                </div>}
                {!hasArrived && nextBlockTimestamp && arrivalTime && <div className='flex ml-auto -mt-2 italic text-light-pink'>
                    {formatSecondsLeftInDaysHours(arrivalTime.arrives_at - nextBlockTimestamp)}
                </div>}
                {hasArrived && <div className='flex ml-auto -mt-2 italic text-light-pink'>
                    {'Has Arrived'}
                </div>}
            <div className='flex items-center mt-3 ml-2 text-xxs'>
                    <span className='italic text-light-pink'>
                        You will get
                    </span>
                </div>
                {resourcesGet && <div className='grid grid-cols-3 gap-2 px-2 py-1'>
                    {resourcesGet.map((resource) => resource && <ResourceCost resourceId={resource.resource_type} amount={resource.balance} />)}
                </div>}
            {!isLoading && <Button onClick={() => { claimOrder() }} disabled={!hasArrived} variant={'success'} className='ml-auto p-2 !h-4 text-xxs !rounded-md'>{`Claim`}</Button>}
            {isLoading && <Button isLoading={true} onClick={() => { }} variant="danger" className='ml-auto p-2 !h-4 text-xxs !rounded-md'>{ }</Button>}
        </div >
    );
};