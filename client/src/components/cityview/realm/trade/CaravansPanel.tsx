import React, { useEffect, useMemo, useState } from 'react';
import { FiltersPanel } from '../../../../elements/FiltersPanel';
import { FilterButton } from '../../../../elements/FilterButton';
import { SortPanel } from '../../../../elements/SortPanel';
import { SortButton, SortInterface } from '../../../../elements/SortButton';
import { Caravan } from './Caravan';
import { CaravanDetails } from '../../../caravans/CaravanDetailsComponent';

type CaravansPanelProps = {}

export const CaravansPanel = ({ }: CaravansPanelProps) => {
    const [activeFilter, setActiveFilter] = useState(false);
    const [showCaravanDetails, setShowCaravanDetails] = useState(false);

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
            {showCaravanDetails && <CaravanDetails caravanId={1} onClose={() => setShowCaravanDetails(false)} />}
            <div className='flex flex-col p-2'>
                <Caravan onClick={() => setShowCaravanDetails(true)} />
            </div>
        </div >
    );
};