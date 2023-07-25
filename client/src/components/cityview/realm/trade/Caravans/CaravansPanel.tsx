import React, { useEffect, useMemo, useState } from 'react';
import { FiltersPanel } from '../../../../../elements/FiltersPanel';
import { FilterButton } from '../../../../../elements/FilterButton';
import { SortPanel } from '../../../../../elements/SortPanel';
import { SortButton, SortInterface } from '../../../../../elements/SortButton';
import { Caravan } from './Caravan';
import { CaravanDetails } from '../../../../caravans/CaravanDetailsComponent';
import { FetchStatus, useGetCaravans, useGetOrders } from '../../../../../hooks/useGraphQLQueries';
import { getComponentValue } from '@latticexyz/recs';
import { useDojo } from '../../../../../DojoContext';
import { Utils } from '@dojoengine/core';
import useRealmStore from '../../../../../hooks/store/useRealmStore';
import { useComponentValue } from '@dojoengine/react';
import useBlockchainStore from '../../../../../hooks/store/useBlockchainStore';

type CaravansPanelProps = {}

export const CaravansPanel = ({ }: CaravansPanelProps) => {
    const [activeFilter, setActiveFilter] = useState(false);
    const [showCaravanDetails, setShowCaravanDetails] = useState(false);
    const [selectedCaravanId, setSelectedCaravanId] = useState<number | null>(null);

    const { components: { Position } } = useDojo();

    const { realmEntityId } = useRealmStore();

    const realmPosition = getComponentValue(Position, Utils.getEntityIdFromKeys([BigInt(realmEntityId)]));

    const onClick = (caravanId: number) => {
        setShowCaravanDetails(true);
        setSelectedCaravanId(caravanId);
    }

    const { data: caravanData, status } = useGetCaravans();

    // TODO: query to get realms caravans
    // const { data: caravanData, status } = useGetCaravans();

    // TODO: do caravanIds and Orders
    let caravanIds: number[] = [];
    if (caravanData && status === FetchStatus.Success) {
        caravanData.entities?.forEach((entity) => {
            if (entity) {
                caravanIds.push(parseInt(entity.keys))
            }
        })
    }

    // TODO: clean 
    // const { data: orderData, status: orderStatus } = useGetOrders();
    // let orderIds: number[] = [];
    // if (orderData && orderStatus === FetchStatus.Success) {
    //     orderData.entities?.forEach((entity) => {
    //         if (entity) {
    //             orderIds.push(parseInt(entity.keys))
    //         }
    //     })
    // }

    let realmCaravanIds: number[] = [];
    for (const caravanId of caravanIds) {
        let position = getComponentValue(Position, Utils.getEntityIdFromKeys([BigInt(caravanId)]));
        const isSamePosition = position && realmPosition && position.x === realmPosition.x && position.y === realmPosition.y;
        if (isSamePosition) {
            realmCaravanIds.push(caravanId);
        }
    }

    const sortingParams = useMemo(() => {
        return [
            { label: 'Number', sortKey: 'number' },
            { label: 'Health-bar', sortKey: 'health', className: 'ml-4' },
            { label: 'Items', sortKey: 'items', className: 'ml-auto mr-4' },
            { label: 'Time-left', sortKey: 'time', className: '' }
        ]
    }, []);

    const [activeSort, setActiveSort] = useState<SortInterface>({
        sortKey: 'number',
        sort: 'none'
    });

    return (
        <div className='flex flex-col' >
            <FiltersPanel className='px-3 py-2'>
                <FilterButton active={activeFilter} onClick={() => setActiveFilter(!activeFilter)}>Filter</FilterButton>
            </FiltersPanel>
            <SortPanel className='px-3 py-2'>
                {sortingParams.map(({ label, sortKey, className }) => (
                    <SortButton className={className} key={sortKey} label={label} sortKey={sortKey} activeSort={activeSort} onChange={(_sortKey, _sort) => {
                        setActiveSort({
                            sortKey: _sortKey,
                            sort: _sort,
                        })
                    }} />
                ))}
            </SortPanel>
            {selectedCaravanId && showCaravanDetails && <CaravanDetails caravanId={selectedCaravanId} onClose={() => setShowCaravanDetails(false)} />}
            {realmCaravanIds.map((caravanId) => <div className='flex flex-col p-2'>
                <Caravan caravanId={caravanId} onClick={() => onClick(caravanId)} />
            </div>)}
        </div >
    );
};