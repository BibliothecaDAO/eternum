import WorldMap from '../../components/worldmap/WorldMap'
import { Model } from '../../components/worldmap/WorldMap.jsx'
import RealmsPositions from '../../components/worldmap/RealmsPositions'
import { Flags } from '../../components/worldmap/Flags.jsx'
import Arcs from '../../components/worldmap/Arcs.jsx'
import realmsJson from '../../geodata/realms.json';
import { useEffect, useState } from 'react'


export const WorldMapScene = () => {

    // choose 10 pairs of random realms
    const [fromRealms, setFromRealms] = useState([])
    const [toRealms, setToRealms] = useState([])
    useEffect(() => {
        const _from = []
        const _to = []
        for (let i = 0; i < 15; i++) {
            const fromRealmIndex = Math.floor(Math.random() * realmsJson.features.length);
            let toRealmIndex = Math.floor(Math.random() * realmsJson.features.length);
            while (toRealmIndex === fromRealmIndex) {
                toRealmIndex = Math.floor(Math.random() * realmsJson.features.length);
            }
            _from.push({
                x: realmsJson.features[fromRealmIndex].xy[0],
                y: 0,
                z: realmsJson.features[fromRealmIndex].xy[1]
            })
            _to.push(
                {
                    x: realmsJson.features[toRealmIndex].xy[0],
                    y: 0,
                    z: realmsJson.features[toRealmIndex].xy[1]
                }
            )
        }
        setFromRealms(_from)
        setToRealms(_to)
    }, [])

    return (
        <>
            {/* <RealmsPositions /> */}
            <Flags />
            <Model />
            {/* <Arcs from={fromRealms} to={toRealms} /> */}
        </>
    )
}