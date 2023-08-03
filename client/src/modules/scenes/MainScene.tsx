import { Canvas } from '@react-three/fiber'
import { Perf } from 'r3f-perf'
import { WorldMapScene } from "./WorldMapScene";
import { RealmCityViewScene } from "./RealmCityViewScene";
import { CombatScene } from "./CombatScene";
import { BastionScene } from "./BastionScene";
import useUIStore from "../../hooks/store/useUIStore";
import { useLocation, Switch, Route } from "wouter"
import { useTransition } from "@react-spring/core"
import { a } from "@react-spring/three"
import { Sky, Environment, Lightformer, useHelper, PerspectiveCamera, MapControls, CameraShake, AdaptiveDpr, AdaptiveEvents } from '@react-three/drei'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { EffectComposer, DepthOfField, Bloom, Noise, Vignette, Outline, EffectComposerContext, SMAA, Sepia } from '@react-three/postprocessing'
// @ts-ignore
import { Sobel } from '../../utils/effects.jsx'
import { useControls, button } from 'leva';
import * as THREE from 'three'
import realmsJson from '../../geodata/realms.json';
import { CameraControls } from '../../utils/Camera';
import { BlendFunction } from 'postprocessing'
import { SoftShadows } from "@react-three/drei"

export const Camera = () => {
    const cameraPosition = useUIStore((state) => state.cameraPosition);
    const setCameraPosition = useUIStore((state) => state.setCameraPosition);
    const cameraTarget = useUIStore((state) => state.cameraTarget);
    const setCameraTarget = useUIStore((state) => state.setCameraTarget);

    return <>
        <CameraControls
            position={cameraPosition}
            target={cameraTarget}
        />

    </>
}
export const MainScene = () => {

    const {
        lightPosition
    } = useControls({
        lightPosition:
        {
            value: { x: 0, y: 10, z: 15 },
            step: 0.01
        },
    })

    const [location] = useLocation()
    // @ts-ignore
    const transition = useTransition(location, {
        from: { scale: [0, 0, 0] },
        enter: { scale: [1, 1, 1] },
        leave: { scale: [0, 0, 0] },
        config: () => (n) => n === "opacity" && { friction: 60 },
    })

    const shakeConfig = useMemo(() => ({
        maxYaw: 0.01, // Max amount camera can yaw in either direction
        maxPitch: 0, // Max amount camera can pitch in either direction
        maxRoll: 0, // Max amount camera can roll in either direction
        yawFrequency: 0.04, // Frequency of the the yaw rotation
        pitchFrequency: 0, // Frequency of the pitch rotation
        rollFrequency: 0, // Frequency of the roll rotation
        intensity: 1, // initial intensity of the shake
        controls: undefined, // if using orbit controls, pass a ref here so we can update the rotation
    }), [])

    return (
        <Canvas
            raycaster={{ params: { Points: { threshold: 0.2 } } }}
            className='rounded-xl'
            camera={{ fov: 15, position: [0, 700, 0], far: 3500 }}
            dpr={[1, 2]}
            gl={
                {
                    powerPreference: "high-performance",
                    antialias: false,
                    stencil: false,
                    depth: false,
                    logarithmicDepthBuffer: true,
                }
            }
        >
            {/* <Perf position="top-left" /> */}
            <Sky azimuth={0.1} inclination={0.6} distance={1000} />
            <ambientLight />
            <Camera />
            <directionalLight castShadow position={[lightPosition.x, lightPosition.y, lightPosition.z]} />
            <CameraShake {...shakeConfig} />
            <Suspense fallback={null}>
                {
                    // @ts-ignore
                    transition(({ opacity, ...props }, location) => (
                        <a.group {...props}>
                            <Switch location={location}>
                                <Route path="/map">
                                    <WorldMapScene />
                                </Route>
                                <Route path="/bastion">
                                    <BastionScene />
                                </Route>
                                <Route path="/realm/:realm_id">
                                    <RealmCityViewScene />
                                </Route>
                            </Switch>
                        </a.group>
                    ))
                }
            </Suspense>
            <EffectComposer multisampling={0}>
                <SMAA />
                <Noise
                    premultiply
                    blendFunction={BlendFunction.SOFT_LIGHT}
                    opacity={0.3}
                />
            </EffectComposer>
            <AdaptiveDpr />
            <AdaptiveEvents />
            {/* <fog attach="fog" color="skyblue" near={250} far={350} /> */}
        </Canvas>
    )
}