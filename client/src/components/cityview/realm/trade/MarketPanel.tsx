import React, { useEffect, useMemo, useState } from 'react';
import { FiltersPanel } from '../../../../elements/FiltersPanel';
import { FilterButton } from '../../../../elements/FilterButton';
import { SortPanel } from '../../../../elements/SortPanel';
import { SortButton, SortInterface } from '../../../../elements/SortButton';
import { TradeOffer } from './TradeOffer';
import { ResourceFilter } from '../../../ResourceFilterComponent';
import { OrdersFilter } from '../../../OrdersFilterComponent';
import { CreateOfferPopup } from './CreateOffer';

type MarketPanelProps = {
    trades: number[];
}

export const MarketPanel = ({ trades }: MarketPanelProps) => {
    const [activeFilter, setActiveFilter] = useState(false);

    const sortingParams = useMemo(() => {
        return [
            { label: 'Realm', sortKey: 'realm' },
            { label: 'Give', sortKey: 'give', className: 'ml-4' },
            { label: 'Exchange rate', sortKey: 'ratio', className: 'ml-auto mr-4' },
            { label: 'Get', sortKey: 'get', className: 'ml-auto mr-4' },
            { label: 'Travel time', sortKey: 'time', className: 'ml-auto mr-4' }
        ]
    }, []);

    const [activeSort, setActiveSort] = useState<SortInterface>({
        sortKey: 'number',
        sort: 'none'
    });

    const dummyTradeOffer = {
        realm: {
            name: 'Realm',
            id: 1,
            order: 'power'
        },
        resourcesGive: [
            {
                resourceId: 1,
                amount: 100
            },
            {
                resourceId: 2,
                amount: 100
            },
            {
                resourceId: 3,
                amount: 100
            },
            {
                resourceId: 4,
                amount: 100
            },
            {
                resourceId: 5,
                amount: 100
            },
            {
                resourceId: 6,
                amount: 100
            },
            {
                resourceId: 7,
                amount: 100
            },
            {
                resourceId: 8,
                amount: 100
            },
            {
                resourceId: 9,
                amount: 100
            },
        ],
        resourcesGet: [
            {
                resourceId: 1,
                amount: 100
            },
            {
                resourceId: 2,
                amount: 100
            },
            {
                resourceId: 3,
                amount: 100
            },
            {
                resourceId: 4,
                amount: 100
            },
            {
                resourceId: 5,
                amount: 100
            },
            {
                resourceId: 6,
                amount: 100
            },
            {
                resourceId: 7,
                amount: 100
            },
            {
                resourceId: 8,
                amount: 100
            },
            {
                resourceId: 9,
                amount: 100
            },
        ],
        ratio: 1,
        timeLeft: 1000,
        offerId: 1
    };

    return (
        <div className='flex flex-col' >
            <FiltersPanel className='px-3 py-2'>
                <FilterButton active={activeFilter} onClick={() => setActiveFilter(!activeFilter)}>Filter</FilterButton>
                <ResourceFilter />
                <OrdersFilter />
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
            {/* // TODO: need to filter on only trades that are relevant (status, not expired, etc) */}
            {/* <CreateOfferPopup onClose={() => { }} onCreate={() => { }} /> */}
            {trades.map((tradeId) => <div className='flex flex-col p-2'>
                <TradeOffer tradeId={tradeId} />
            </div>)}
        </div >
    );
};