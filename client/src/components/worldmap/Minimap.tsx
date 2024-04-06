import useUIStore from "@/hooks/store/useUIStore";
import { MapControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import { Mesh, Vector3 } from "three";

export const MiniMap = () => {
  return (
    <Canvas>
      <MapControls />
      <pointLight position={[10, 10, 10]} />
      <MiniMapMesh />
    </Canvas>
  );
};

export const MiniMapMesh = () => {
  const setCameraPosition = useUIStore((state) => state.setCameraPosition);
  const setCameraTarget = useUIStore((state) => state.setCameraTarget);

  const { mouse, camera, raycaster } = useThree();

  const mesh = useRef<any>(null);

  const actualMapWidth = 100000;
  const actualMapHeight = 100000;

  // Define the scale factors if the minimap is not a 1:1 representation of the actual map
  const scaleX = actualMapWidth / 100;
  const scaleY = actualMapHeight / 100;

  const handleClick = (event: any) => {
    // Update the raycaster with the current mouse and camera information
    raycaster.setFromCamera(mouse, camera);

    // Assuming the minimap is on the XZ plane and Y is up, intersect with a plane at Y=0
    const planeIntersect = raycaster.intersectObject(mesh.current);

    if (planeIntersect.length > 0) {
      // Get the point of intersection
      const point = planeIntersect[0].point;

      console.log("Clicked on minimap at", point.x, point.z);

      // Update the camera position in your state
      setCameraTarget(new Vector3(point.x, point.y, point.z));
      //   setCameraPosition(
      //     new Vector3(point.x + (50 * Math.random() < 1 ? 1 : -1), 35, point.z + 50 * Math.random() < 1 ? 1 : -1),
      //   );
    }
  };

  return (
    <mesh ref={mesh} onClick={handleClick}>
      <planeGeometry args={[100 * scaleX, 100 * scaleY]} />
      <meshStandardMaterial wireframe color="hotpink" />
    </mesh>
  );
};
