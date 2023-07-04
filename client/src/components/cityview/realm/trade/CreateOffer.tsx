import React, { useEffect, useState } from 'react';
import { SecondaryPopup } from '../../../../elements/SecondaryPopup';
import Button from '../../../../elements/Button';
import { Headline } from '../../../../elements/Headline';
import { ResourceCost } from '../../../../elements/ResourceCost';
import { NumberInput } from '../../../../elements/NumberInput';
import { SelectableResource } from '../../../../elements/SelectableResource';
import { resources } from '../../../../constants/resources';
import { ReactComponent as ArrowSeparator } from '../../../../assets/icons/common/arrow-separator.svg';
type CreateOfferPopupProps = {
    onClose: () => void;
    onCreate: () => void;
}

export const CreateOfferPopup = ({ onClose, onCreate }: CreateOfferPopupProps) => {
    const [step, setStep] = useState<number>(1);
    const [selectedResourceIdsGive, setSelectedResourceIdsGive] = useState<number[]>([]);
    const [selectedResourceIdsGet, setSelectedResourceIdsGet] = useState<number[]>([]);
    const [selectedResourcesGiveAmounts, setSelectedResourcesGiveAmounts] = useState<{ [key: number]: number }>({});
    const [selectedResourcesGetAmounts, setSelectedResourcesGetAmounts] = useState<{ [key: number]: number }>({});
    const [selectedCaravan, setSelectedCaravan] = useState<number>(0);

    useEffect(() => { }, []);

    return (
        <SecondaryPopup>
            <SecondaryPopup.Head>
                <div className='flex items-center space-x-1'>
                    <div className='mr-0.5'>Create Offer:</div>
                </div>
            </SecondaryPopup.Head>
            <SecondaryPopup.Body>
                <div className='flex flex-col items-center pt-2'>
                    {step == 1 && <SelectResourcesPanel
                        selectedResourceIdsGive={selectedResourceIdsGive}
                        setSelectedResourceIdsGive={e => {
                            setSelectedResourceIdsGive(e); setSelectedResourcesGiveAmounts(
                                Object.fromEntries(e.map(id => [id, 0]))
                            )
                        }}
                        selectedResourceIdsGet={selectedResourceIdsGet}
                        setSelectedResourceIdsGet={e => {
                            setSelectedResourceIdsGet(e); setSelectedResourcesGetAmounts(
                                Object.fromEntries(e.map(id => [id, 0]))
                            )
                        }}
                    />}
                    {step == 2 && <SelectResourcesAmountPanel
                        selectedResourceIdsGive={selectedResourceIdsGive}
                        selectedResourcesGiveAmounts={selectedResourcesGiveAmounts}
                        setSelectedResourcesGiveAmounts={setSelectedResourcesGiveAmounts}
                        selectedResourceIdsGet={selectedResourceIdsGet}
                        selectedResourcesGetAmounts={selectedResourcesGetAmounts}
                        setSelectedResourcesGetAmounts={setSelectedResourcesGetAmounts}
                    />}
                </div>
                <div className='flex justify-between m-2 text-xxs'>
                    <Button className='!px-[6px] !py-[2px] text-xxs' onClick={() => setStep(step - 1)} variant='primary'>Close</Button>
                    <Button className='!px-[6px] !py-[2px] text-xxs' onClick={() => setStep(step + 1)} variant='success'>Create</Button>
                </div>
            </SecondaryPopup.Body>
        </SecondaryPopup >
    );
};

const SelectResourcesPanel = ({ selectedResourceIdsGive, setSelectedResourceIdsGive, selectedResourceIdsGet, setSelectedResourceIdsGet }: {
    selectedResourceIdsGive: number[];
    setSelectedResourceIdsGive: (selectedResourceIds: number[]) => void;
    selectedResourceIdsGet: number[];
    setSelectedResourceIdsGet: (selectedResourceIds: number[]) => void;
}) => {
    return <div className="grid grid-cols-9 gap-2 p-2">
        <div className='flex flex-col items-center col-span-4'>
            <Headline className='mb-2'>You Give</Headline>
            <div className='grid grid-cols-4 gap-2'>
                {resources.map(({ id, trait: name }) => (
                    <SelectableResource
                        key={id}
                        resourceId={id}
                        amount={100}
                        disabled={100 < 0 /*check amount*/}
                        selected={selectedResourceIdsGive.includes(id)}
                        onClick={() => {
                            if (selectedResourceIdsGive.includes(id)) {
                                setSelectedResourceIdsGive(selectedResourceIdsGive.filter((_id) => _id !== id));
                            } else {
                                setSelectedResourceIdsGive([...selectedResourceIdsGive, id]);
                            }
                        }}
                    />
                ))}
            </div>
        </div>
        <div className='flex items-center justify-center'>
            <ArrowSeparator />
        </div>
        <div className='flex flex-col items-center col-span-4'>
            <Headline className='mb-2'>You Get</Headline>
            <div className='grid grid-cols-4 gap-2'>
                {resources.map(({ id, trait: name }) => (
                    <SelectableResource
                        key={id}
                        resourceId={id}
                        amount={100}
                        selected={selectedResourceIdsGet.includes(id)}
                        disabled={selectedResourceIdsGive.includes(id)}
                        onClick={() => {
                            if (selectedResourceIdsGet.includes(id)) {
                                setSelectedResourceIdsGet(selectedResourceIdsGet.filter((_id) => _id !== id));
                            } else {
                                setSelectedResourceIdsGet([...selectedResourceIdsGet, id]);
                            }
                        }}
                    />
                ))}
            </div>
        </div>
    </div>
}

const SelectResourcesAmountPanel = ({ selectedResourceIdsGive, selectedResourceIdsGet, selectedResourcesGiveAmounts, selectedResourcesGetAmounts, setSelectedResourcesGiveAmounts, setSelectedResourcesGetAmounts }: {
    selectedResourceIdsGive: number[];
    selectedResourceIdsGet: number[];
    selectedResourcesGiveAmounts: { [key: number]: number };
    selectedResourcesGetAmounts: { [key: number]: number };
    setSelectedResourcesGiveAmounts: (selectedResourcesGiveAmounts: { [key: number]: number }) => void;
    setSelectedResourcesGetAmounts: (selectedResourcesGetAmounts: { [key: number]: number }) => void;
}) => {

    return <>
        <div className='grid grid-cols-9 gap-2 p-2'>
            <div className='flex flex-col items-center col-span-4 space-y-2'>
                <Headline className='mb-2'>You Give</Headline>
                {
                    selectedResourceIdsGive.map((id) => (
                        <div key={id} className='flex items-center w-full'>
                            <NumberInput max={100000} value={selectedResourcesGiveAmounts[id]} onChange={(value) => {
                                setSelectedResourcesGiveAmounts({ ...selectedResourcesGiveAmounts, [id]: value });
                            }} />
                            <div className='ml-2'>
                                <ResourceCost resourceId={id} amount={selectedResourcesGiveAmounts[id]} />
                            </div>
                        </div>
                    ))
                }
            </div>
            <div className='flex items-center justify-center'>
                <ArrowSeparator />
            </div>
            <div className='flex flex-col items-center col-span-4 space-y-2'>
                <Headline className='mb-2'>You Get</Headline>
                {
                    selectedResourceIdsGet.map((id) => (
                        <div key={id} className='flex items-center w-full'>
                            <NumberInput max={100000} value={selectedResourcesGetAmounts[id]} onChange={(value) => {
                                setSelectedResourcesGetAmounts({ ...selectedResourcesGetAmounts, [id]: value });
                            }} />
                            <div className='ml-2'>
                                <ResourceCost resourceId={id} amount={selectedResourcesGetAmounts[id]} />
                            </div>
                        </div>
                    ))
                }
            </div>
        </div>
        <div className='flex text-xs text-center text-white'>
            Caravan Capacity <div className='ml-1 text-gold'>0kg</div>
        </div>
    </>
}