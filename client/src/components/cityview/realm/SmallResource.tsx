import { useComponentValue } from "@dojoengine/react"
import { findResourceById } from "../../../constants/resources"
import { ResourceIcon } from "../../../elements/ResourceIcon"
import { useDojo } from "../../../DojoContext"
import { Utils } from "@dojoengine/core"
import { currencyFormat } from "../../../utils/utils"
import useRealmStore from "../../../hooks/store/useRealmStore"

export const SmallResource = ({ resourceId }: { resourceId: number} ) => {
    const {components: {Resource} } = useDojo()

    const { realmEntityId } = useRealmStore()
    let resource = useComponentValue(Resource, Utils.getEntityIdFromKeys([BigInt(realmEntityId), BigInt(resourceId)]))
    return  (
        <div className='flex items-center'>
            <ResourceIcon resource={findResourceById(resourceId)?.trait || ""} size="xs" className="mr-1" />
            <div className="text-xxs">{currencyFormat(resource?.balance || 0)}</div>
        </div>
    )
}