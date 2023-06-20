import React, { useEffect, useState } from 'react';
import { FilterButton } from '../elements/FilterButton';
import { FilterPopup } from '../elements/FilterPopup';

type ResourceFilterProps = {}

export const ResourceFilter = ({ }: ResourceFilterProps) => {
    const [state, setState] = useState(false);

    useEffect(() => { }, []);

    return (
        <>
            <FilterButton active={state}>
                qwe
            </FilterButton>
            <FilterPopup>
                <FilterPopup.Head>
                    Resources:
                </FilterPopup.Head>
                <FilterPopup.Body>
                    Test
                </FilterPopup.Body>
            </FilterPopup>
        </>
    );
};