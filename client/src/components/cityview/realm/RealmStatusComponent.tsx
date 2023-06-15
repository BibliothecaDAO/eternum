import React, { useEffect, useState } from 'react';
import { ReactComponent as SkullIcon } from '../../../assets/icons/common/skull.svg';
import { ReactComponent as ShieldIcon } from '../../../assets/icons/common/shield.svg';
import { ReactComponent as HappyIcon } from '../../../assets/icons/common/happy.svg';

import clsx from 'clsx';
import { BaseStatus } from '../../../elements/BaseStatus';

type RealmStatusComponentProps = {} & React.ComponentPropsWithRef<'div'>

export const RealmStatusComponent = ({ className }: RealmStatusComponentProps) => {

    const realmStatus = {
        defence: 'vulnerable',
        happiness: 'happy'
    }

    const defence = {
        vulnerable: {
            title: 'Vulnerable',
            icon: <ShieldIcon className="mr-2 fill-current" />
        },
        weak: 'Weak',
        strong: 'Strong',
    }

    const hapiness = {
        starving: {
            title: 'People are starving',
            icon: <SkullIcon className="mr-2 fill-current" />,
        },
        unhappy: 'People are unhappy',
        happy: {
            title: 'People are happy',
            icon: <HappyIcon className="mr-2 fill-current" />,
        }
    }


    return (
        <div className={clsx("flex space-x-4", className)}>
            <BaseStatus state={realmStatus.defence == 'strong' ? 'good' : 'bad'} >
                {defence[realmStatus.defence].icon}
                {defence[realmStatus.defence].title}
            </BaseStatus>
            <BaseStatus state={realmStatus.happiness == 'happy' ? 'good' : 'bad'}>
                {hapiness[realmStatus.happiness].icon}
                {hapiness[realmStatus.happiness].title}
            </BaseStatus>
        </div >
    );
};

export default RealmStatusComponent;