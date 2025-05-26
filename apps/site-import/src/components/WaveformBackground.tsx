import { useEffect, useRef } from "react";
import * as THREE from "three";

interface TreeData {
  mesh: THREE.Group;
  position: THREE.Vector3;
}

interface RoadSegment {
  mesh: THREE.Group;
  endZ: number;
}

export function WaveformBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef(0);
  const treesRef = useRef<TreeData[]>([]);
  const roadSegmentsRef = useRef<RoadSegment[]>([]);

  useEffect(() => {
    if (!containerRef.current) return;

    // --- Scene Setup ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb); // Sky blue background
    scene.fog = new THREE.Fog(0x87ceeb, 100, 500);

    // --- Camera Setup ---
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.set(0, 8, 15);

    // --- Renderer Setup ---
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    containerRef.current.appendChild(renderer.domElement);

    // --- Lights ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 100, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.left = -100;
    directionalLight.shadow.camera.right = 100;
    directionalLight.shadow.camera.top = 100;
    directionalLight.shadow.camera.bottom = -100;
    directionalLight.shadow.camera.near = 0.1;
    directionalLight.shadow.camera.far = 200;
    scene.add(directionalLight);

    // --- Create Car ---
    const carGroup = new THREE.Group();

    // Car body
    const bodyGeometry = new THREE.BoxGeometry(4, 2, 8);
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0xff0000,
      metalness: 0.6,
      roughness: 0.4,
    });
    const carBody = new THREE.Mesh(bodyGeometry, bodyMaterial);
    carBody.position.y = 1.5;
    carBody.castShadow = true;
    carGroup.add(carBody);

    // Car roof
    const roofGeometry = new THREE.BoxGeometry(3, 1.5, 5);
    const roofMaterial = new THREE.MeshStandardMaterial({
      color: 0xcc0000,
      metalness: 0.6,
      roughness: 0.4,
    });
    const carRoof = new THREE.Mesh(roofGeometry, roofMaterial);
    carRoof.position.y = 3;
    carRoof.position.z = -0.5;
    carRoof.castShadow = true;
    carGroup.add(carRoof);

    // Wheels
    const wheelGeometry = new THREE.CylinderGeometry(0.8, 0.8, 0.5, 16);
    const wheelMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      metalness: 0.2,
      roughness: 0.8,
    });

    const wheelPositions = [
      { x: -2, y: 0.8, z: 3 },
      { x: 2, y: 0.8, z: 3 },
      { x: -2, y: 0.8, z: -3 },
      { x: 2, y: 0.8, z: -3 },
    ];

    wheelPositions.forEach((pos) => {
      const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(pos.x, pos.y, pos.z);
      wheel.castShadow = true;
      carGroup.add(wheel);
    });

    carGroup.position.set(0, 0, 0);
    scene.add(carGroup);

    // --- Create Ground Segments ---
    const groundSegments: THREE.Mesh[] = [];
    const groundSegmentLength = 200;
    const groundWidth = 300;

    const createGroundSegment = (startZ: number) => {
      const groundGeometry = new THREE.PlaneGeometry(
        groundWidth,
        groundSegmentLength + 5, // Add overlap to prevent gaps
        20,
        40
      );
      const groundMaterial = new THREE.MeshStandardMaterial({
        color: 0x3a5f3a,
        roughness: 0.8,
      });

      // Add some terrain variation to the ground
      const positions = groundGeometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const y = positions.getY(i);
        const worldZ = startZ - groundSegmentLength / 2 + y;

        // Base height follows road undulation but lower
        let height = Math.sin(worldZ * 0.05) * 2 + Math.sin(worldZ * 0.02) * 3;

        // Add some random terrain variation away from the road
        const distanceFromCenter = Math.abs(x);
        if (distanceFromCenter > 20) {
          height += (Math.random() - 0.5) * 2 * (distanceFromCenter / 100);
        }

        positions.setZ(i, height);
      }
      groundGeometry.attributes.position.needsUpdate = true;
      groundGeometry.computeVertexNormals();

      const ground = new THREE.Mesh(groundGeometry, groundMaterial);
      ground.rotation.x = -Math.PI / 2;
      ground.position.z = startZ - groundSegmentLength / 2;
      ground.receiveShadow = true;
      scene.add(ground);

      return ground;
    };

    // Initialize ground segments
    for (let i = 0; i < 5; i++) {
      groundSegments.push(createGroundSegment(-i * groundSegmentLength));
    }

    // --- Road Generation Function ---
    const roadSegmentLength = 50;
    const roadWidth = 12;

    const createRoadSegment = (startZ: number): RoadSegment => {
      const segmentGroup = new THREE.Group();

      const segmentGeometry = new THREE.PlaneGeometry(
        roadWidth,
        roadSegmentLength,
        10,
        20
      );
      const segmentMaterial = new THREE.MeshStandardMaterial({
        color: 0x333333,
        roughness: 0.9,
      });

      const segment = new THREE.Mesh(segmentGeometry, segmentMaterial);
      segment.rotation.x = -Math.PI / 2;
      segment.receiveShadow = true;

      // Add road undulation
      const positions = segmentGeometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        const y = positions.getY(i); // Y in plane space = Z in world space after rotation
        const worldZ = startZ - roadSegmentLength / 2 + y;
        const height =
          Math.sin(worldZ * 0.05) * 3 + Math.sin(worldZ * 0.02) * 5;
        positions.setZ(i, height);
      }
      segmentGeometry.attributes.position.needsUpdate = true;
      segmentGeometry.computeVertexNormals();

      segmentGroup.add(segment);

      // Add road lines with undulation
      const lineMaterial = new THREE.MeshStandardMaterial({
        color: 0xffff00,
        emissive: 0xffff00,
        emissiveIntensity: 0.3,
      });

      // Center dashed line
      for (let j = 0; j < 5; j++) {
        const dashGeometry = new THREE.PlaneGeometry(0.3, 8, 1, 4);
        const dashPositions = dashGeometry.attributes.position;

        // Apply same undulation to dash
        for (let i = 0; i < dashPositions.count; i++) {
          const y = dashPositions.getY(i);
          const dashZ = -roadSegmentLength / 2 + j * 10 + 5 + y;
          const worldZ = startZ + dashZ;
          const height =
            Math.sin(worldZ * 0.05) * 3 + Math.sin(worldZ * 0.02) * 5;
          dashPositions.setZ(i, height + 0.05); // Slightly above road
        }
        dashGeometry.attributes.position.needsUpdate = true;
        dashGeometry.computeVertexNormals();

        const dash = new THREE.Mesh(dashGeometry, lineMaterial);
        dash.rotation.x = -Math.PI / 2;
        dash.position.z = -roadSegmentLength / 2 + j * 10 + 5;
        segmentGroup.add(dash);
      }

      // Side lines
      [-roadWidth / 2 + 0.5, roadWidth / 2 - 0.5].forEach((xOffset) => {
        const sideLineGeometry = new THREE.PlaneGeometry(
          0.3,
          roadSegmentLength,
          1,
          20
        );
        const sidePositions = sideLineGeometry.attributes.position;

        // Apply same undulation to side lines
        for (let i = 0; i < sidePositions.count; i++) {
          const y = sidePositions.getY(i);
          const worldZ = startZ - roadSegmentLength / 2 + y;
          const height =
            Math.sin(worldZ * 0.05) * 3 + Math.sin(worldZ * 0.02) * 5;
          sidePositions.setZ(i, height + 0.05); // Slightly above road
        }
        sideLineGeometry.attributes.position.needsUpdate = true;
        sideLineGeometry.computeVertexNormals();

        const line = new THREE.Mesh(sideLineGeometry, lineMaterial);
        line.rotation.x = -Math.PI / 2;
        line.position.x = xOffset;
        segmentGroup.add(line);
      });

      segmentGroup.position.z = startZ - roadSegmentLength / 2;
      scene.add(segmentGroup);

      return {
        mesh: segmentGroup,
        endZ: startZ - roadSegmentLength,
      };
    };

    // Initialize road segments
    for (let i = 0; i < 10; i++) {
      roadSegmentsRef.current.push(createRoadSegment(-i * roadSegmentLength));
    }

    // --- Tree Creation Function ---
    const createTree = (x: number, z: number): TreeData => {
      const treeGroup = new THREE.Group();

      // Tree trunk
      const trunkGeometry = new THREE.CylinderGeometry(0.5, 0.7, 4);
      const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
      const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
      trunk.position.y = 2;
      trunk.castShadow = true;
      treeGroup.add(trunk);

      // Tree foliage (multiple spheres for more natural look)
      const foliagePositions = [
        { x: 0, y: 5, z: 0, scale: 2.5 },
        { x: -1, y: 4.5, z: 0, scale: 1.8 },
        { x: 1, y: 4.5, z: 0, scale: 1.8 },
        { x: 0, y: 6.5, z: 0, scale: 1.5 },
      ];

      foliagePositions.forEach((pos) => {
        const foliageGeometry = new THREE.SphereGeometry(pos.scale, 8, 6);
        const foliageMaterial = new THREE.MeshStandardMaterial({
          color: 0x228b22,
          roughness: 0.8,
        });
        const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
        foliage.position.set(pos.x, pos.y, pos.z);
        foliage.castShadow = true;
        treeGroup.add(foliage);
      });

      // Calculate ground height at tree position
      const worldZ = Math.abs(z);
      const groundHeight =
        Math.sin(worldZ * 0.05) * 2 + Math.sin(worldZ * 0.02) * 3;

      treeGroup.position.set(x, groundHeight, z);

      // Animate tree appearance
      treeGroup.scale.set(0, 0, 0);
      scene.add(treeGroup);

      return {
        mesh: treeGroup,
        position: new THREE.Vector3(x, groundHeight, z),
      };
    };

    // --- Animation Variables ---
    let carSpeed = 0;
    const maxSpeed = 1; // Reduced from 2 to 1 for slower speed
    const acceleration = 0.01; // Reduced acceleration too

    // --- Animation Loop ---
    const animate = () => {
      requestAnimationFrame(animate);
      timeRef.current += 0.016;

      // Accelerate car
      if (carSpeed < maxSpeed) {
        carSpeed += acceleration;
      }

      // Move car forward
      carGroup.position.z -= carSpeed;

      // Find which road segment the car is on
      let carRoadHeight = 0;
      // let carOnRoad = false;

      for (const segment of roadSegmentsRef.current) {
        const segmentZ = segment.mesh.position.z;
        const segmentStart = segmentZ + roadSegmentLength / 2;
        const segmentEnd = segmentZ - roadSegmentLength / 2;

        // Check if car is within this segment
        if (
          carGroup.position.z <= segmentStart &&
          carGroup.position.z >= segmentEnd
        ) {
          // Calculate relative position within segment
          // const relativeZ = carGroup.position.z - segmentZ;
          const worldZ = carGroup.position.z;

          // Use the same height calculation as the road
          carRoadHeight =
            Math.sin(Math.abs(worldZ) * 0.05) * 3 +
            Math.sin(Math.abs(worldZ) * 0.02) * 5;
          // carOnRoad = true;
          break;
        }
      }

      // Set car height with a small offset above the road
      carGroup.position.y = carRoadHeight + 0.5; // 0.5 units above road surface

      // Calculate tilt based on road slope
      const lookAheadDistance = 5;
      const currentZ = Math.abs(carGroup.position.z);
      const lookAheadZ = currentZ + lookAheadDistance;

      const currentHeight =
        Math.sin(currentZ * 0.05) * 3 + Math.sin(currentZ * 0.02) * 5;
      const lookAheadHeight =
        Math.sin(lookAheadZ * 0.05) * 3 + Math.sin(lookAheadZ * 0.02) * 5;

      const slope = (lookAheadHeight - currentHeight) / lookAheadDistance;
      carGroup.rotation.x = Math.atan(slope) * 0.3; // Reduced tilt for stability

      // Camera follows car
      camera.position.x = carGroup.position.x;
      camera.position.y = carGroup.position.y + 8;
      camera.position.z = carGroup.position.z + 15;
      camera.lookAt(
        carGroup.position.x,
        carGroup.position.y + 2,
        carGroup.position.z
      );

      // Rotate wheels
      carGroup.children.forEach((child, index) => {
        if (index >= 2) {
          // Wheels start at index 2
          child.rotation.x += carSpeed * 0.5;
        }
      });

      // Generate new road segments
      const lastSegment =
        roadSegmentsRef.current[roadSegmentsRef.current.length - 1];
      if (carGroup.position.z < lastSegment.endZ + 200) {
        const newSegment = createRoadSegment(lastSegment.endZ);
        roadSegmentsRef.current.push(newSegment);
      }

      // Generate new ground segments
      const lastGroundSegment = groundSegments[groundSegments.length - 1];
      if (
        carGroup.position.z <
        lastGroundSegment.position.z - groundSegmentLength / 2 + 300
      ) {
        const newGroundZ =
          lastGroundSegment.position.z - groundSegmentLength + 2; // Small overlap
        groundSegments.push(createGroundSegment(newGroundZ));
      }

      // Remove old road segments
      roadSegmentsRef.current = roadSegmentsRef.current.filter((segment) => {
        if (segment.mesh.position.z > carGroup.position.z + 100) {
          scene.remove(segment.mesh);
          // Dispose all children meshes
          segment.mesh.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.geometry.dispose();
              if (child.material instanceof THREE.Material) {
                child.material.dispose();
              }
            }
          });
          return false;
        }
        return true;
      });

      // Remove old ground segments
      for (let i = groundSegments.length - 1; i >= 0; i--) {
        if (groundSegments[i].position.z > carGroup.position.z + 200) {
          scene.remove(groundSegments[i]);
          groundSegments[i].geometry.dispose();
          (groundSegments[i].material as THREE.Material).dispose();
          groundSegments.splice(i, 1);
        }
      }

      // Generate trees - increased probability and density
      if (Math.random() < 0.3) {
        // Increased from 0.1 to 0.3
        const side = Math.random() < 0.5 ? -1 : 1;
        const x = side * (15 + Math.random() * 30); // Increased spread
        const z = carGroup.position.z - 50 - Math.random() * 50;
        const tree = createTree(x, z);
        treesRef.current.push(tree);
      }

      // Add some trees closer to the road occasionally
      if (Math.random() < 0.15) {
        const side = Math.random() < 0.5 ? -1 : 1;
        const x = side * (8 + Math.random() * 5); // Closer to road
        const z = carGroup.position.z - 30 - Math.random() * 40;
        const tree = createTree(x, z);
        treesRef.current.push(tree);
      }

      // Animate and clean up trees
      treesRef.current = treesRef.current.filter((tree) => {
        // Grow tree
        if (tree.mesh.scale.x < 1) {
          tree.mesh.scale.x += 0.05;
          tree.mesh.scale.y += 0.05;
          tree.mesh.scale.z += 0.05;
        }

        // Remove trees that are too far behind
        if (tree.position.z > carGroup.position.z + 50) {
          scene.remove(tree.mesh);
          return false;
        }
        return true;
      });

      renderer.render(scene, camera);
    };
    animate();

    // --- Handle Resize ---
    const onWindowResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", onWindowResize);

    return () => {
      window.removeEventListener("resize", onWindowResize);
      renderer.dispose();
      if (
        containerRef.current &&
        renderer.domElement.parentNode === containerRef.current
      ) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={containerRef} className="fixed inset-0 -z-10" />;
}
