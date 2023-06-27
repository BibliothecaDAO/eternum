import React, { useEffect, useMemo, useState } from 'react';
import { FiltersPanel } from '../../../../elements/FiltersPanel';
import { FilterButton } from '../../../../elements/FilterButton';
import { SortPanel } from '../../../../elements/SortPanel';
import { SortButton, SortInterface } from '../../../../elements/SortButton';
import { LaborComponent } from './LaborComponent';

type LaborPanelProps = {}

export const LaborPanel = ({ }: LaborPanelProps) => {
    const [activeFilter, setActiveFilter] = useState(false);

    const sortingParams = useMemo(() => {
        return [
            { label: 'Number', sortKey: 'number', className: 'mr-auto' },
            { label: 'Balance', sortKey: 'balance', className: 'mr-auto' },
            { label: 'Expires', sortKey: 'expires', className: 'mr-auto' },
            { label: 'Harvested', sortKey: 'harvested', className: 'mr-auto' }
        ]
    }, []);

    const [activeSort, setActiveSort] = useState<SortInterface>({
        sortKey: 'number',
        sort: 'none'
    });

    return (
        <div className='flex flex-col' >
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
            <div className='flex flex-col p-2'>
                <LaborComponent resourceId={10001} />
            </div>
        </div >
    );
};