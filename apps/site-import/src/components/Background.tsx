import { useEffect, useRef } from "react";
import * as THREE from "three";
import { createNoise3D } from "simplex-noise";

// Biome color palette
const BIOME_COLORS = [
  0x2e8b57, // forest (green)
  0xdeb887, // desert (tan)
  0x87ceeb, // water (blue)
  0xffffff, // snow (white)
  0x808080, // mountain (gray)
  0x228b22, // jungle (dark green)
  0xf4a460, // savanna (light brown)
];

// Helper to get biome color from noise value
function getBiomeColor(n: number) {
  if (n < -0.25) return BIOME_COLORS[2]; // water
  if (n < 0) return BIOME_COLORS[0]; // forest
  if (n < 0.25) return BIOME_COLORS[1]; // desert
  if (n < 0.5) return BIOME_COLORS[6]; // savanna
  if (n < 0.7) return BIOME_COLORS[4]; // mountain
  if (n < 0.85) return BIOME_COLORS[3]; // snow
  return BIOME_COLORS[5]; // jungle
}

export function Background() {
  const containerRef = useRef<HTMLDivElement>(null);
  const animationIdRef = useRef<number | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x101018);

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 6);

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.7);
    dirLight.position.set(5, 10, 7);
    scene.add(dirLight);

    // Create a simple globe
    const radius = 2;
    const detail = 50; // Reduced for better performance
    const geometry = new THREE.IcosahedronGeometry(radius, detail);

    // Color the globe with biomes
    const simplex = createNoise3D();
    const colorAttr = new THREE.BufferAttribute(
      new Float32Array(geometry.attributes.position.count * 3),
      3
    );

    // Store forest locations for tree placement
    const forestLocations: {
      position: THREE.Vector3;
      normal: THREE.Vector3;
    }[] = [];

    for (let i = 0; i < geometry.attributes.position.count; i++) {
      const vertex = new THREE.Vector3().fromBufferAttribute(
        geometry.attributes.position,
        i
      );
      const n = simplex(vertex.x * 0.9, vertex.y * 0.9, vertex.z * 0.9);
      const color = new THREE.Color(getBiomeColor(n));
      colorAttr.setXYZ(i, color.r, color.g, color.b);

      // Check if the vertex is in a forest biome
      if (getBiomeColor(n) === BIOME_COLORS[0] && Math.random() > 0.95) {
        // Add a random chance
        const normal = vertex.clone().normalize(); // Get the normal (direction outwards)
        forestLocations.push({ position: vertex, normal });
      }
    }

    geometry.setAttribute("color", colorAttr);

    // Material
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      flatShading: true,
      roughness: 0.3,
      metalness: 0.2,
    });

    // Globe mesh
    const globe = new THREE.Mesh(geometry, material);
    scene.add(globe);

    // Add Trees using InstancedMesh
    const treeGeometry = new THREE.ConeGeometry(0.05, 0.2, 4); // Simple cone shape
    const treeMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a4d2e,
      roughness: 0.8,
    }); // Dark green
    const treeCount = forestLocations.length;
    const treeInstancedMesh = new THREE.InstancedMesh(
      treeGeometry,
      treeMaterial,
      treeCount
    );

    const dummy = new THREE.Object3D(); // Used to position each instance
    const up = new THREE.Vector3(0, 1, 0);
    const coneHeight = 0.2;
    for (let i = 0; i < treeCount; i++) {
      const { position, normal } = forestLocations[i];

      // 1. Set position to the vertex location on the sphere
      dummy.position.copy(position);

      // 2. Orient the tree to stand upright on the sphere surface
      // Align the cone's local Y-axis with the surface normal
      dummy.quaternion.setFromUnitVectors(up, normal);

      // 3. Translate the cone along its local Y-axis (now aligned with normal)
      // so its base sits on the surface (cone origin is center)
      dummy.translateY(coneHeight / 2);

      // 4. Apply random slight rotation around its *local* up axis (the normal)
      dummy.rotateY(Math.random() * Math.PI * 2);

      dummy.updateMatrix();
      treeInstancedMesh.setMatrixAt(i, dummy.matrix);
    }
    treeInstancedMesh.instanceMatrix.needsUpdate = true;
    globe.add(treeInstancedMesh); // Add trees as children of the globe

    // Simple Animation loop - just rotation, no vertex updates
    const animate = () => {
      // Rotate the globe on Y axis (simple spinning)
      globe.rotation.y += 0.005;

      // Add a slight tilt on X and Z for more interesting movement
      globe.rotation.x = Math.sin(Date.now() * 0.0005) * 0.1;
      globe.rotation.z = Math.cos(Date.now() * 0.0005) * 0.1;

      renderer.render(scene, camera);
      animationIdRef.current = requestAnimationFrame(animate);
    };

    // Start animation
    animate();

    // Handle resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", handleResize);

    // Cleanup
    return () => {
      if (animationIdRef.current) cancelAnimationFrame(animationIdRef.current);
      window.removeEventListener("resize", handleResize);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      geometry.dispose();
      material.dispose();
      treeGeometry.dispose();
      treeMaterial.dispose();
    };
  }, []);

  return <div ref={containerRef} className="fixed inset-0 -z-10" />;
}
