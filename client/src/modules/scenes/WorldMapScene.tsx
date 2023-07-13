// @ts-ignore
import { Model } from '../../components/worldmap/WorldMap.jsx'
// @ts-ignore
import { Flags } from '../../components/worldmap/Flags.jsx'
import realmsJson from '../../geodata/realms.json';
import { useEffect, useState } from 'react'


export const WorldMapScene = () => {

    return (
        <>
            <Flags />
            <Model />
        </>
    )
}