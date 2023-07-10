import React, { useEffect, useState } from 'react';
import { ReactComponent as SkullIcon } from '../../../assets/icons/common/skull.svg';
import { ResourceIcon } from '../../../elements/ResourceIcon';
import { ResourcesIds, findResourceById } from '../../../constants/resources';
import { currencyFormat } from '../../../utils/utils.jsx';
import { useComponentValue } from "@dojoengine/react";
import clsx from 'clsx';
import { Utils } from '@dojoengine/core';
import { useDojo } from '../../../DojoContext';
import useRealm from '../../../hooks/store/useRealmStore';
import { unpackResources } from '../../../utils/packedData';
import { useLaborStore } from '../../../hooks/store/useLaborStore';
import useRealmStore from '../../../hooks/store/useRealmStore';

type RealmResourcesComponentProps = {} & React.ComponentPropsWithRef<'div'>

export const RealmResourcesComponent = ({ className }: RealmResourcesComponentProps) => {
    const {
      components: { Realm },
    } = useDojo();
  
    let { realmEntityId } = useRealmStore();

    let realm = useComponentValue(Realm, Utils.getEntityIdFromKeys([BigInt(realmEntityId)]));

    // unpack the resources
    let realmResourceIds: number[] = [ResourcesIds['Wheat'], ResourcesIds['Fish']];
    let unpackedResources: number[] = [];

    // TODO: don't do unpacking at each render but rather in useRealmStore at beginning and store result
    if (realm) {
      unpackedResources = unpackResources(BigInt(realm.resource_types_packed), realm.resource_types_count);
      realmResourceIds = realmResourceIds.concat(unpackedResources);
    }
  
    if (realmResourceIds.length > 2) {
      return (
        <div className={clsx('flex h-16 space-x-4', className)}>
          <div className="flex mx-auto space-x-2">
            {realmResourceIds.map((resourceId) => (
              <ResourceComponent key={resourceId} realmEntityId={realmEntityId} resourceId={resourceId} />
            ))}
          </div>
        </div>
      );
    } else {
      return <></>;
    }
  };
  
  interface ResourceComponentProps {
    realmEntityId: number;
    resourceId: number;
  }
  
  const ResourceComponent: React.FC<ResourceComponentProps> = ({ realmEntityId, resourceId }) => {
    const {
      components: { Resource },
    } = useDojo();

    const { productivity } = useLaborStore((state) => state);

    let resource = useComponentValue(Resource, Utils.getEntityIdFromKeys([BigInt(realmEntityId), BigInt(resourceId)]));

    return (
      <>
        <div className="flex flex-col">
          <div className="flex items-center p-3 text-xs font-bold text-white bg-black/60 rounded-xl h-11">
            <ResourceIcon resource={findResourceById(resourceId)?.trait as string} size="xs" className="mr-1" />
            <div className="text-xs">{currencyFormat(resource ? resource.balance : 0)}</div>
          </div>
          {/* TODO: speed at which resources get harvested */}
            <div
              className={clsx(
                'text-xxs mt-2 rounded-[5px] px-2 h-4 w-min',
                productivity[resourceId] > 0 && 'text-order-vitriol bg-dark-green',
                (productivity[resourceId] === 0 || productivity[resourceId] === undefined) && 'text-gold bg-brown'
              )}
            >
              {productivity[resourceId] === 0 || productivity[resourceId] === undefined ? 'IDLE': `${productivity[resourceId]}/s` }
            </div>
        </div>
        {resourceId === ResourcesIds['Fish'] && <div className="flex items-center mx-3 -translate-y-2">|</div>}
      </>
    );
}
  

export default RealmResourcesComponent;