import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Trail } from "@react-three/drei";

const material = new THREE.MeshBasicMaterial({ color: "orangered" });
const sphere = new THREE.SphereGeometry(0.1, 32, 32);

const Arcs = ({ paths }) => {
  const spheresRefs = useRef([]);

  const curves = useMemo(
    () =>
      paths.map((path, i) => {
        const point_1 = new THREE.Vector3(-path.from.x, -0.3, -path.from.y);
        const point_2 = new THREE.Vector3(-path.to.x, -0.3, -path.to.y);
        const pathLength = point_1.distanceTo(point_2);
        const pointBetweenFromAndTo = new THREE.Vector3(
          (-path.from.x + -path.to.x) / 2,
          Math.max(pathLength / 2, 3),
          (-path.from.y + -path.to.y) / 2,
        );
        return new THREE.QuadraticBezierCurve3(point_1, pointBetweenFromAndTo, point_2);
      }),
    [paths],
  );

  let t = 0;
  useFrame(() => {
    spheresRefs.current.forEach((sphereRef, i) => {
      sphereRef.position.copy(curves[i].getPointAt(t));
    });
    t += 0.0025;
    if (t >= 1) t = 0;
  });

  return (
    <>
      {curves.map((curve, i) => {
        return (
          <Trail
            key={i}
            width={20} // Width of the line
            color={"orangered"} // Color of the line
            length={20} // Length of the line
            decay={1} // How fast the line fades away
            local={true} // Wether to use the target's world or local positions
            stride={0} // Min distance between previous and current point
            interval={1} // Number of frames to wait before next calculation
            target={undefined} // Optional target. This object will produce the trail.
            attenuation={(width) => width} // A function to define the width in each point along it.
          >
            <mesh
              ref={(el) => (spheresRefs.current[i] = el)}
              position={[0, 0, 0]}
              geometry={sphere}
              material={material}
            />
          </Trail>
        );
      })}
    </>
  );
};

export default Arcs;
