import { useEffect, useState, useMemo } from "react";
import { useGLTF, Html } from "@react-three/drei";
import realmsJson from "@/data/geodata/realms.json";
import flagsHeights from "@/data/geodata/flags_heights.json";
import realmsOrders from "@/data/geodata/realms_raw.json";
import * as THREE from "three";
import useUIStore from "@/hooks/store/useUIStore";
import { useGetRealms } from "@/hooks/helpers/useRealm";
import gsap from "gsap";
import { useFrame } from "@react-three/fiber";
import { orderNameDict } from "@bibliothecadao/eternum";
import { getRealmUIPosition, getUIPositionFromColRow } from "@/ui/utils/utils";

const count = realmsJson.features.length;

const orders = [
  "Fox",
  "Detection",
  "Reflection",
  "Twins",
  "Power",
  "Titans",
  "Giants",
  "Skill",
  "Enlightenment",
  "Protection",
  "Perfection",
  "Brilliance",
  "Anger",
  "Rage",
  "Vitriol",
  "Fury",
];

realmsJson.features = realmsJson.features.map((feature, index) => {
  const order = realmsOrders[index].order;
  return {
    ...feature,
    order: order.replace("the ", ""),
  };
});

export function Flags(props) {
  const { nodes, materials } = useGLTF("/models/flags.glb");

  const setCameraPosition = useUIStore((state) => state.setCameraPosition);
  const setCameraTarget = useUIStore((state) => state.setCameraTarget);
  const showRealmsFlags = useUIStore((state) => state.showRealmsFlags);
  const setShowRealmsFlags = useUIStore((state) => state.setShowRealmsFlags);
  const setSelectedEntity = useUIStore((state) => state.setSelectedEntity);

  const [tooltipPosition, setTooltipPosition] = useState([0, 0, 0]);
  const [hoveredRealm, setHoveredRealm] = useState(null);

  const [woodInstances, setWoodInstances] = useState([]);
  const [flagInstances, setFlagInstances] = useState([]);
  const [hitBoxInstances, setHitBoxInstances] = useState([]);

  const realms = useGetRealms();

  const ordersRealms = useMemo(
    () =>
      orders.map((order, i) => {
        return realms.filter((realm) => orderNameDict[realm.order] === order.toLowerCase());
      }),
    [realms],
  );

  let scale = new THREE.Vector3();
  const tempObject = new THREE.Object3D();
  let matrix = new THREE.Matrix4();

  const updateFlagScale = (id, _scale, meshIndex) => {
    if (!woodInstances.length || !flagInstances.length) return;
    scale.set(_scale, _scale, _scale);
    //woodInstances.getMatrixAt(id, matrix);
    woodInstances[meshIndex].getMatrixAt(id, matrix);
    matrix.decompose(tempObject.position, tempObject.quaternion, tempObject.scale);
    tempObject.scale.copy(scale);
    tempObject.updateMatrix();

    woodInstances[meshIndex].setMatrixAt(id, tempObject.matrix);
    flagInstances[meshIndex].setMatrixAt(id, tempObject.matrix);
  };

  useFrame(({ camera }) => {
    const pos = camera.position;
    if (pos) {
      // const needShowFlags = pos.y <= 50;
      const needShowFlags = true;
      if (needShowFlags !== showRealmsFlags) {
        setShowRealmsFlags(needShowFlags);
      }
    }
  });

  useEffect(() => {
    if (!woodInstances.length || !flagInstances.length) return;

    const scales = {
      startScale: showRealmsFlags ? 0.01 : 1,
      endScale: showRealmsFlags ? 10 : 0.01,
    };
    const tl = gsap.timeline();
    tl.to(scales, {
      startScale: scales.endScale,
      duration: 0.7,
      ease: "Bounce.easeOut",
      onUpdate: () => {
        //console.log('scales.startScale', scales.startScale);
        ordersRealms.forEach((orderRealms, index) => {
          orderRealms.forEach((realm, i) => {
            updateFlagScale(i, scales.startScale, index);
          });
        });

        woodInstances.forEach((woodInstance) => {
          woodInstance.instanceMatrix.needsUpdate = true;
        });
        flagInstances.forEach((flagInstance) => {
          flagInstance.instanceMatrix.needsUpdate = true;
        });
      },
    });
  }, [showRealmsFlags, woodInstances, flagInstances]);

  useEffect(() => {
    let woodMeshes, flagMeshes;
    let woodGeometry, flagGeometry;
    let woodMaterial;

    const _woodMesh = nodes.Plane003_1.geometry;
    const _flagMesh = nodes.Plane003.geometry;

    woodGeometry = _woodMesh.clone();
    flagGeometry = _flagMesh.clone();
    woodMaterial = materials.Wood;

    const hitBoxGeometry = new THREE.BoxGeometry(4.5, 4.5, 2);
    const hitBoxMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0 });

    const _position = new THREE.Vector3();
    const dummy = new THREE.Object3D();

    const defaultTransform = new THREE.Matrix4()
      .makeRotationX(-Math.PI / 2)
      .multiply(new THREE.Matrix4().makeScale(0.1, 0.1, 0.1));

    woodGeometry.applyMatrix4(defaultTransform);
    flagGeometry.applyMatrix4(defaultTransform);

    //woodMesh = new THREE.InstancedMesh( woodGeometry, woodMaterial, count )
    //flagMesh = new THREE.InstancedMesh( flagGeometry, flagMaterial, count )
    woodMeshes = orders.map((order, i) => new THREE.InstancedMesh(woodGeometry, woodMaterial, ordersRealms[i].length));
    flagMeshes = orders.map(
      (order, i) => new THREE.InstancedMesh(flagGeometry, materials[order], ordersRealms[i].length),
    );

    const hitBoxMeshes = orders.map(
      (order, i) => new THREE.InstancedMesh(hitBoxGeometry, hitBoxMaterial, ordersRealms[i].length),
    );

    woodMeshes.forEach((woodMesh) => {
      woodMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    });
    flagMeshes.forEach((flagMesh) => {
      flagMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    });
    hitBoxMeshes.forEach((hitBoxMesh) => {
      hitBoxMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    });

    ordersRealms.forEach((orderRealms, index) => {
      orderRealms.forEach((realm, i) => {
        const { x, y } = getRealmUIPosition(realm.realmId);
        const z = -0 - flagsHeights[Number(realm.realmId) - 1];
        // _position.set(-y, -x, -20);
        _position.set(-x, y, -3.5);
        dummy.position.copy(_position);
        dummy.rotateZ(
          //random
          Math.random() * Math.PI * 2,
        );
        dummy.updateMatrix();

        woodMeshes[index].setMatrixAt(i, dummy.matrix);
        flagMeshes[index].setMatrixAt(i, dummy.matrix);
        _position.set(-x - 0.38, y, -1.5);
        dummy.position.copy(_position);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        hitBoxMeshes[index].setMatrixAt(i, dummy.matrix);
      });
    });
    setWoodInstances(woodMeshes);
    setFlagInstances(flagMeshes);
    setHitBoxInstances(hitBoxMeshes);
  }, [ordersRealms]);

  const clickHandler = (e, index) => {
    e.stopPropagation();
    if (e.intersections.length > 0) {
      setSelectedEntity({
        id: hoveredRealm.entity_id,
        position: hoveredRealm.position,
      });

      const instanceId = e.intersections[0].instanceId;
      const point = e.intersections[0].point;
      // updateFlagScale(instanceId, 2);
      // woodInstances.instanceMatrix.needsUpdate = true;
      // flagInstances.instanceMatrix.needsUpdate = true;
      const targetPos = new THREE.Vector3(point.x, point.y, point.z);
      const cameraPos = new THREE.Vector3(
        point.x + 25 * (Math.random() < 0.5 ? 1 : -1),
        25,
        point.z + 25 * (Math.random() < 0.5 ? 1 : -1),
      );
      setCameraTarget(targetPos);
      setCameraPosition(cameraPos);
    }
  };

  const posVector = new THREE.Vector3();
  const hoverHandler = (e, index) => {
    if (e.intersections.length > 0) {
      const instanceId = e.instanceId;
      const point = getUIPositionFromColRow(
        ordersRealms[index][instanceId]?.position?.x,
        ordersRealms[index][instanceId]?.position?.y,
        false,
      );
      const tooltipPos = posVector.set(point.x, 3, -point.y);
      setTooltipPosition(tooltipPos);
      setHoveredRealm(ordersRealms[index][instanceId]);
    }
  };

  return (
    <>
      <Html position={tooltipPosition} distanceFactor={50}>
        <div className="p-2 bg-brown -translate-x-1/2 -mt-[50px] clip-angled-sm text-md text-gold shadow-2xl border-2 border-gradient whitespace-nowrap pointer-events-none">
          {hoveredRealm && `${hoveredRealm.ownerName} (${hoveredRealm.name})`}
        </div>
      </Html>
      <group {...props} dispose={null} position={[-0.38, 0, -0.04]} rotation={[-Math.PI / 2, Math.PI, 0]}>
        {woodInstances.map((woodInstance, index) => {
          return (
            <group key={index}>
              <group
                onPointerEnter={(e) => hoverHandler(e, index)}
                onPointerLeave={() => {
                  posVector.set(0, 0, 0);
                  setTooltipPosition(posVector);
                }}
              >
                <primitive object={hitBoxInstances[index]} renderOrder={3} />
              </group>
              <group>
                <primitive object={woodInstance} renderOrder={3} />
                <primitive object={flagInstances[index]} renderOrder={3} />
              </group>
            </group>
          );
        })}
      </group>
    </>
  );
}

useGLTF.preload("/models/flags.glb");
