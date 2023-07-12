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
import { CaravanMember, Order, Resource, ResourcesOffer, Trade } from '../../../../../types';
import { useComponentValue } from '@dojoengine/react';
import { Utils } from '@dojoengine/core';
import useRealmStore from '../../../../../hooks/store/useRealmStore';
import useBlockchainStore from '../../../../../hooks/store/useBlockchainStore';
import { formatSecondsLeftInDaysHours } from '../../labor/laborUtils';
import { getOrderIdsFromTrade, getRealmIdByPosition, getRealmNameById, getRealmOrderNameById, getResourceIdsFromFungibleEntities, getTotalResourceWeight } from '../TradeUtils';
import { getComponentValue } from '@latticexyz/recs';
import { useGetTradeFromCaravanId } from '../../../../../hooks/useGraphQLQueries';

type CaravanProps = {
    orderId: number;
    tradeId: number;
} & React.HTMLAttributes<HTMLDivElement>;

export const IncomingOrders = ({ orderId, tradeId, ...props }: CaravanProps) => {
    const { realmEntityId } = useRealmStore();

    const {
        systemCalls: { claim_fungible_order },
        components: { ArrivalTime, FungibleEntities, Resource },
    } = useDojo();

    const { nextBlockTimestamp } = useBlockchainStore();

    let arrivalTime = getComponentValue(ArrivalTime, Utils.getEntityIdFromKeys([BigInt(orderId)]));

    const fungibleEntitiesGet = getComponentValue(FungibleEntities, Utils.getEntityIdFromKeys([BigInt(orderId)]));
    let resourceEntityIdsGet = getResourceIdsFromFungibleEntities(orderId, fungibleEntitiesGet?.key || 0, fungibleEntitiesGet?.count || 0);
    let resourcesGet: Resource[] = [];
    for (let i = 0; i < resourceEntityIdsGet.length; i++) {
        resourcesGet.push(getComponentValue(Resource, resourceEntityIdsGet[i]) ?? { resource_type: 0, balance: 0 });
    }

    const hasArrived = (arrivalTime !== undefined) && (nextBlockTimestamp !== undefined) && arrivalTime.arrives_at <= nextBlockTimestamp;

    return (
        <div className={clsx('flex flex-col p-2 border rounded-md border-gray-gold text-xxs text-gray-gold', props.className)} onClick={props.onClick}>
            <div> {`orderId: ${orderId} and tradeId: ${tradeId}`}</div>
            {<Button onClick={() => { claim_fungible_order({ entity_id: realmEntityId, trade_id: tradeId }) }} disabled={!hasArrived} variant={'success'} className='ml-auto p-2 !h-4 text-xxs !rounded-md'>{`Claim`}</Button>}
        </div >
    );
};