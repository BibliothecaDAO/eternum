import * as THREE from 'three'
import { useState, useEffect, useMemo } from 'react'
import { useControls } from 'leva';
import realmsJson from '../../geodata/realms.json';
import useUIStore from '../../hooks/store/useUIStore';

const RealmsPositions = () => {

    const [bufferGeometry, setBufferGeometry] = useState(new THREE.BufferGeometry());

    const setCameraPosition = useUIStore((state) => state.setCameraPosition);
    const setCameraTarget = useUIStore((state) => state.setCameraTarget);

    const { realmsPosition, realmsScale } = useControls({
        realmsPosition:
        {
            value: { x: 0, z: 0, y: 0.65 },
            step: 0.01
        },
        realmsScale:
        {
            value: 1,
            step: 0.01
        }
    })

    const calculatedPositions = useMemo(() => {
        const tmpPos = new Float32Array(realmsJson.features.length * 3);
        for (let i = 0; i < realmsJson.features.length; i++) {
            const i3 = i * 3;
            // realms.xy[0], realms.xy[1], 3
            tmpPos[i3] = realmsJson.features[i].xy[0];
            tmpPos[i3 + 1] = realmsJson.features[i].xy[1];
            tmpPos[i3 + 2] = 0.233;
        }
        return tmpPos;
    }, [])

    const calculatedColors = useMemo(() => {
        const tmpCol = new Float32Array(realmsJson.features.length * 3);
        for (let i = 0; i < realmsJson.features.length; i++) {
            const i3 = i * 3;
            // realms.xy[0], realms.xy[1], 3
            tmpCol[i3] = 1
            tmpCol[i3 + 1] = 0
            tmpCol[i3 + 2] = 0
        }
        return tmpCol;
    }, [])

    useEffect(() => {

        bufferGeometry.setAttribute(
            'position',
            new THREE.BufferAttribute(calculatedPositions, 3)
        );

        bufferGeometry.setAttribute(
            'color',
            new THREE.BufferAttribute(calculatedColors, 3)
        );
    }, [])

    const realmsMaterial = new THREE.PointsMaterial({
        size: 1,
        depthWrite: false,
        vertexColors: true,
    });
    const clickHandler = (e: any) => {
        const colors = calculatedColors;
        const positions = calculatedPositions;
        for (let inter of e.intersections) {
            // recolor clicked and +- 100 around
            const i3 = (inter.index) * 3;
            // realms.xy[0], realms.xy[1], 3
            colors[i3] = 1;
            colors[i3 + 1] = 1;
            colors[i3 + 2] = 0;
        }
        const point = e.intersections[0].point;
        const newGeometry = new THREE.BufferGeometry();
        newGeometry.setAttribute(
            'position',
            new THREE.BufferAttribute(positions, 3)
        );
        newGeometry.setAttribute(
            'color',
            new THREE.BufferAttribute(colors, 3)
        );
        setBufferGeometry(newGeometry);
        setCameraTarget(new THREE.Vector3(point.x, point.y, point.z))
        setCameraPosition(new THREE.Vector3(point.x + (50 * Math.random() < 1 ? 1 : -1), 35, point.z + 50 * Math.random() < 1 ? 1 : -1))
    }

    return <>
        <points onClick={clickHandler} geometry={bufferGeometry} material={realmsMaterial} position={
            [realmsPosition.x, realmsPosition.y, realmsPosition.z]} rotation={[-Math.PI / 2, Math.PI, 0]}
            scale={[
                realmsScale,
                realmsScale,
                realmsScale
            ]} />
    </>
}

export default RealmsPositions;