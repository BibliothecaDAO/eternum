import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo } from "react";

export function BannerFlag(props: any) {
  const { nodes, materials }: any = useGLTF("/models/flag_single.glb");

  // * TODO: Get actual banners baseURL and let user choose banner tokenId at onboarding
  //
  // const material = useMemo(() => {
  //   const textureUrl = `https://banners-api-rpftgk2jfa-uk.a.run.app/images/legacy/5605.png`;
  //   const texture = new THREE.TextureLoader().load(textureUrl, function (tex) {
  //     tex.wrapS = THREE.RepeatWrapping;
  //     tex.wrapT = THREE.RepeatWrapping;
  //     tex.repeat.set(1, -1);
  //     tex.offset.setX(1);
  //   });
  //   // Change to MeshPhongMaterial and adjust color to darken the texture
  //   const material = new THREE.MeshPhongMaterial({
  //     color: 0xaaaaaa, // Darker shade of white
  //     specular: 0x222222, // Low specular highlights
  //     shininess: 1, // Adjust shininess for a subtle effect
  //   });
  //   material.map = texture;
  //   material.side = THREE.DoubleSide;
  //   material.map.needsUpdate = true;
  //   material.transparent = true;
  //   material.opacity = 1.0;
  //   //material.wireframe = true;
  //   return material;
  // }, []);

  const positionAttribute = useMemo(() => {
    if (nodes.Plane008 && nodes.Plane008.geometry) {
      console.log(materials);

      return nodes.Plane008.geometry.getAttribute("position");
    }
    return null;
  }, [nodes]);

  useFrame((state, delta) => {
    const time = state.clock.getElapsedTime();
    if (positionAttribute) {
      for (let i = 0; i < positionAttribute.count; i++) {
        const y = positionAttribute.getY(i);
        const z = positionAttribute.getZ(i);
        const waveY1 = Math.cos(y + time * 5);
        const waveY2 = Math.cos(y * 2 + time * 8) / 2;
        const waveZ1 = Math.cos(z * 3 + time * 4);
        positionAttribute.setX(i, 0.05 + ((waveY1 + waveY2 + waveZ1) * (y - 2.2781)) / 50);
      }

      positionAttribute.needsUpdate = true;
    }
  });

  return (
    <>
      <group {...props} position={[0, 3, 0]}>
        <mesh geometry={nodes.Plane008.geometry} material={materials.Vitriol} />
        <mesh geometry={nodes.Plane008_1.geometry} material={materials.Wood} />
      </group>
    </>
  );
}

useGLTF.preload("/models/flag_single.glb");
