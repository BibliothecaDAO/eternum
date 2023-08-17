import { useState } from 'react';
import { FilterButton } from '../elements/FilterButton';
import { SecondaryPopup } from '../elements/SecondaryPopup';
import { resources } from '../constants/resources';
import { SelectBox } from '../elements/SelectBox';
import { ResourceIcon } from '../elements/ResourceIcon';
import { ReactComponent as CloseIcon } from '../assets/icons/common/cross.svg';
import Button from '../elements/Button';

type ResourceFilterProps = {}

export const ResourceFilter = ({ }: ResourceFilterProps) => {
    const [selectedResources, setSelectedResources] = useState<string[]>([]);
    const [popupOpened, setPopupOpened] = useState<boolean>(false);

    const selectResource = (resource: string) => {
        if (selectedResources.includes(resource)) {
            setSelectedResources(selectedResources.filter((r) => r !== resource));
        } else {
            setSelectedResources([...selectedResources, resource]);
        }
    };

    return (
        <>
            <FilterButton active={popupOpened} onClick={() => setPopupOpened(!popupOpened)}>
                Resources
            </FilterButton>
            {popupOpened && <SecondaryPopup>
                <SecondaryPopup.Head>
                    <div className='flex items-center space-x-1'>
                        <div className='mr-0.5'>Resources:</div>
                        {selectedResources.map((resource, index) => (
                            <ResourceIcon key={index} size='xs' resource={resource} />

                        ))}
                        <CloseIcon className="w-3 h-3 cursor-pointer fill-white" onClick={() => setSelectedResources([])} />
                    </div>
                </SecondaryPopup.Head>
                <SecondaryPopup.Body>
                    <div className='grid grid-cols-3 gap-1 p-2'>
                        {resources.map((resource, index) => (
                            <SelectBox key={index} selected={selectedResources.includes(resource.trait)} onClick={() => selectResource(resource.trait)}>
                                <div className='flex items-center'>
                                    <ResourceIcon className='mr-1' size='xs' resource={resource.trait} />
                                    {resource.trait}
                                </div>
                            </SelectBox>
                        ))}
                    </div>
                    <div className='flex justify-end mb-2 mr-2'>
                        <Button onClick={() => setPopupOpened(false)} variant='primary'>Close</Button>
                    </div>
                </SecondaryPopup.Body>
            </SecondaryPopup>}
        </>
    );
};