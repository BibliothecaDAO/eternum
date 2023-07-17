//Camera.tsx
import { MapControls } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import gsap from "gsap";
import { useEffect, useRef } from "react";
import { Vector3 } from "three";
import useUIStore from "../hooks/store/useUIStore";
import { useControls, button } from 'leva';
import * as THREE from 'three'

interface Point {
    x: number;
    y: number;
    z: number;
}

interface Props {
    position: Point;
    target: Point;
}
const CameraControls = ({ position, target }: Props) => {

    const {
        camera,
        gl: { domElement },
    } = useThree();
    const ref = useRef<any>(null);

    const setCameraPosition = useUIStore((state) => state.setCameraPosition);
    const setCameraTarget = useUIStore((state) => state.setCameraTarget);

    useControls({
        mapView: button(() => {
            const pos = {
                x: -7.043878696238032,
                y: 166.17021444157382,
                z: 222.6600723287719
            }
            const target = { x: 0.023274850081444903, y: -0.5977038789716049, z: -0.8013790329276046 }
            setCameraPosition(pos)
            setCameraTarget(target)
        }),
        realmView: button(() => {
            const pos = {
                x: 399.79750334746063,
                y: 699.249767349755,
                z: 1163.119859554027
            }
            const target = {
                "x": -0.2596104873702977,
                "y": -0.5003629837749848,
                "z": -0.8259777716834455
            }
            setCameraPosition(pos)
            setCameraTarget(target)
        }),
        saveCameraPosition: button(() => {
            console.log({ ...camera.position }, { ...(new THREE.Vector3(0, 0, -1)).applyQuaternion(camera.quaternion) })
        })
    })

    camera.up = new Vector3(0, 1, 0);
    function cameraAnimate(): void {
        if (ref.current) {
            gsap.timeline().to(camera.position, {
                duration: 2,
                repeat: 0,
                x: position.x,
                y: position.y,
                z: position.z,
                ease: "power3.inOut",
            });

            gsap.timeline().to(
                ref.current.target,
                {
                    duration: 2,
                    repeat: 0,
                    x: target.x,
                    y: target.y,
                    z: target.z,
                    ease: "power3.inOut",
                },
                "<"
            );
        }
    }

    useEffect(() => {
        cameraAnimate();
    }, [target, position]);
    return (
        <MapControls
            ref={ref}
            args={[camera, domElement]}
            panSpeed={2}
            maxDistance={1400}
            minDistance={25}
            maxPolarAngle={Math.PI / 3}
            makeDefault
        />
    );
};

export { CameraControls };
