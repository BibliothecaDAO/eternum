import React, { useEffect, useMemo, useState } from 'react';
import { FiltersPanel } from '../../../../elements/FiltersPanel';
import { FilterButton } from '../../../../elements/FilterButton';
import { SortPanel } from '../../../../elements/SortPanel';
import { SortButton, SortInterface } from '../../../../elements/SortButton';
import { LaborComponent } from './LaborComponent';
import useRealmStore from '../../../../hooks/store/useRealmStore';
import { useComponentValue } from '@dojoengine/react';
import { useDojo } from '../../../../DojoContext';
import { Utils } from '@dojoengine/core';
import { unpackResources } from '../../../../utils/packedData';
import { LABOR_CONFIG_ID } from '../../../../constants/labor';
import { ResourcesIds } from '../../../../constants/resources';
import { LaborBuildPopup } from './LaborBuild';
import { LaborConfig } from '../../../../types';

type LaborPanelProps = {}

export const LaborPanel = ({ }: LaborPanelProps) => {
    const {
        components: { Realm, LaborConfig },
    } = useDojo();

    const [activeFilter, setActiveFilter] = useState(false);
    const [buildResource, setBuildResource] = useState<number | null>(null);

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

    let realmEntityId = useRealmStore((state) => state.realmEntityId);
    let realm = useComponentValue(Realm, Utils.getEntityIdFromKeys([BigInt(realmEntityId)]));

    // unpack the resources
    let realmResourceIds: number[] = [ResourcesIds['Wheat'], ResourcesIds['Fish']];
    let unpackedResources: number[] = [];

    if (realm) {
        unpackedResources = unpackResources(BigInt(realm.resource_types_packed), realm.resource_types_count);
        realmResourceIds = realmResourceIds.concat(unpackedResources);
    }

    let laborConfig = useComponentValue(LaborConfig, Utils.getEntityIdFromKeys([BigInt(LABOR_CONFIG_ID)]))

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
            {buildResource && <LaborBuildPopup resourceId={buildResource} onClose={() => setBuildResource(null)} onBuild={() => { }} />}
            {realmResourceIds.map((resourceId) => <div className='flex flex-col p-2'>
                <LaborComponent onBuild={() => { buildResource == resourceId ? setBuildResource(null) : setBuildResource(resourceId) }} resourceId={resourceId} realm={realm} laborConfig={laborConfig as LaborConfig} />
            </div>)}
        </div >
    );
};