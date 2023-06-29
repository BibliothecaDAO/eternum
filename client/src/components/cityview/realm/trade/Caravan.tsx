import React, { useEffect, useState } from 'react';
import { OrderIcon } from '../../../../elements/OrderIcon';
import Button from '../../../../elements/Button';
import { ResourceIcon } from '../../../../elements/ResourceIcon';
import { findResourceById } from '../../../../constants/resources';
import { ReactComponent as Pen } from '../../../../assets/icons/common/pen.svg';
import { ReactComponent as CaretDownFill } from '../../../../assets/icons/common/caret-down-fill.svg';
import { ReactComponent as DonkeyIcon } from '../../../../assets/icons/units/donkey.svg';
import { ReactComponent as PremiumIcon } from '../../../../assets/icons/units/premium.svg';

import ProgressBar from '../../../../elements/ProgressBar';
import { Dot } from '../../../../elements/Dot';

type CaravanProps = {

} & React.HTMLAttributes<HTMLDivElement>;

export const Caravan = ({ ...props }: CaravanProps) => {
    const [state, setState] = useState();

    useEffect(() => { }, []);

    return (
        <div className='flex flex-col p-2 border rounded-md border-gray-gold text-xxs text-gray-gold' onClick={props.onClick}>
            <div className='flex items-center text-xxs'>
                <div className='flex items-center p-1 -mt-2 -ml-2 italic border border-t-0 border-l-0 text-light-pink rounded-br-md border-gray-gold'>
                    #1
                </div>
                <div className='flex items-center ml-1 -mt-2'>
                    <span className='italic text-light-pink'>
                        Traveling to
                    </span>
                    <div className='flex items-center ml-1 mr-1 text-gold'>
                        <OrderIcon order='brilliance' className='mr-1' size='xs' />
                        Lordlacrima
                    </div>
                    <span className='italic text-light-pink'>
                        with
                    </span>
                    <div className='flex items-center ml-1 text-gold'>
                        9’999’403
                        <div className='mx-0.5 italic text-light-pink'>
                            /
                        </div>
                        10’000’000
                        <CaretDownFill className='ml-1 fill-current' />
                    </div>
                </div>
                <div className='flex ml-auto -mt-2 italic text-gold'>
                    Idle <Pen className="ml-1 fill-gold" />
                </div>
            </div>
            <div className='flex mt-2'>
                <div className='grid w-full grid-cols-2 gap-5'>
                    <div className='flex flex-col'>
                        <div className='grid grid-cols-12 gap-0.5'>
                            <ProgressBar className="bg-orange" containerClassName='col-span-1' rounded progress={100} />
                            <ProgressBar className='bg-red' containerClassName='col-span-3' rounded progress={100} />
                            <ProgressBar containerClassName='col-span-8' rounded progress={100} />
                        </div>
                        <div className='flex items-center justify-between mt-[6px] text-xxs'>
                            <DonkeyIcon />
                            <div className='flex items-center space-x-[6px]'>
                                <div className='flex flex-col items-center'>
                                    <Dot colorClass='bg-green' />
                                    <div className='mt-1 text-green'>30</div>
                                </div>
                                <div className='flex flex-col items-center'>
                                    <Dot colorClass='bg-yellow' />
                                    <div className='mt-1 text-dark'>0</div>
                                </div>
                                <div className='flex flex-col items-center'>
                                    <Dot colorClass='bg-orange' />
                                    <div className='mt-1 text-orange'>5</div>
                                </div>
                                <div className='flex flex-col items-center'>
                                    <Dot colorClass='bg-red' />
                                    <div className='mt-1 text-red'>10</div>
                                </div>
                                <div className='flex flex-col items-center'>
                                    <Dot colorClass='bg-light-pink' />
                                    <div className='mt-1 text-dark'>0</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className='flex flex-col'>
                        <div className='grid grid-cols-12 gap-0.5'>
                            <ProgressBar className="bg-orange" containerClassName='col-span-1' rounded progress={100} />
                            <ProgressBar className='bg-red' containerClassName='col-span-3' rounded progress={100} />
                            <ProgressBar containerClassName='col-span-8' rounded progress={100} />
                        </div>
                        <div className='flex items-center justify-between mt-[6px] text-xxs'>
                            <PremiumIcon />
                            <div className='flex items-center space-x-[6px]'>
                                <div className='flex flex-col items-center'>
                                    <Dot colorClass='bg-green' />
                                    <div className='mt-1 text-green'>30</div>
                                </div>
                                <div className='flex flex-col items-center'>
                                    <Dot colorClass='bg-yellow' />
                                    <div className='mt-1 text-dark'>0</div>
                                </div>
                                <div className='flex flex-col items-center'>
                                    <Dot colorClass='bg-orange' />
                                    <div className='mt-1 text-orange'>5</div>
                                </div>
                                <div className='flex flex-col items-center'>
                                    <Dot colorClass='bg-red' />
                                    <div className='mt-1 text-red'>10</div>
                                </div>
                                <div className='flex flex-col items-center'>
                                    <Dot colorClass='bg-light-pink' />
                                    <div className='mt-1 text-dark'>0</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div >
    );
};