import { useEffect, useRef } from "react";
import * as THREE from "three";

export function WaveformBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef(0);
  // Removed lineMeshesRef as it's specific to the old waveform animation.

  useEffect(() => {
    if (!containerRef.current) return;

    // --- Scene Setup ---
    const scene = new THREE.Scene();
    // A dark background, suitable for a Tron aesthetic.
    scene.background = new THREE.Color(0x000000);

    // --- Camera Setup ---
    const camera = new THREE.PerspectiveCamera(
      75, // Wider FOV
      window.innerWidth / window.innerHeight,
      0.1, // Near plane closer for being inside the valley
      2500 // Increased far plane for a longer valley
    );
    // Initial camera position inside the valley
    camera.position.set(0, 20, 180); // Lower Y, adjust Z to be further "in"
    // Look slightly ahead and down the valley path
    camera.lookAt(0, 15, 0);

    // --- Renderer Setup ---
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);

    // --- Create Ground Plane and Grid ---
    // Ground plane
    const planeSize = 4000; // Greatly increased for a longer valley
    const planeGeometry = new THREE.PlaneGeometry(
      planeSize,
      planeSize,
      200,
      50
    ); // Increased X segments for smoother deformation on larger plane
    const planeMaterial = new THREE.MeshStandardMaterial({
      color: 0x050505, // Dark color for the ground
      wireframe: false, // Back to solid
      metalness: 0.2,
      roughness: 0.8,
    });
    const groundPlane = new THREE.Mesh(planeGeometry, planeMaterial);
    groundPlane.rotation.x = -Math.PI / 2; // Rotate to be horizontal
    groundPlane.position.y = 0; // Set at the base of the scene
    scene.add(groundPlane);

    // --- Shape the Valley ---
    const positions = planeGeometry.attributes.position;
    const vertex = new THREE.Vector3();
    const valleyWidth = 200; // How wide the flat part of the valley is
    const valleySteepness = 80; // How steep the walls are
    const wallHeight = 150; // Maximum height of the valley walls

    for (let i = 0; i < positions.count; i++) {
      vertex.fromBufferAttribute(positions, i);

      // Create a valley shape:
      // Raise the terrain on the sides (larger |x| values)
      // vertex.x is the original x position of the vertex in the plane's local space
      const distanceFromCenter = Math.abs(vertex.x);
      let height = 0;

      if (distanceFromCenter > valleyWidth / 2) {
        // Calculate how far into the "wall" zone the vertex is
        const wallPenetration = distanceFromCenter - valleyWidth / 2;
        // Use a smooth curve for the walls (e.g., quadratic or smoothstep-like)
        // For simplicity, a linear rise capped at wallHeight
        height = Math.min(
          wallPenetration * (wallHeight / valleySteepness),
          wallHeight
        );
      }

      // Correct derivation: Plane's local Z maps to World Y after rotation. So set local Z to desired height.
      // positions.getZ(i) is 0 for a PlaneGeometry initially.
      positions.setZ(i, height); // Sets the local Z, which becomes world Y.
    }
    planeGeometry.attributes.position.needsUpdate = true;
    planeGeometry.computeVertexNormals(); // Important for lighting after deforming

    // --- Add Lights ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.2); // Soft white light
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8); // Stronger directional light
    directionalLight.position.set(50, 200, 100); // Position it to cast some shadows
    directionalLight.target = groundPlane; // Optional: make it look at the ground
    // directionalLight.castShadow = true; // Enable if you want shadows, requires shadow setup on renderer and objects
    scene.add(directionalLight);

    // --- Create Character ---
    // const characterGeometry = new THREE.BoxGeometry(10, 10, 10); // Simple cube character
    const characterGeometry = new THREE.SphereGeometry(6, 32, 16); // Sphere: radius, widthSegments, heightSegments
    const characterMaterial = new THREE.MeshStandardMaterial({
      color: 0xff0000, // Bright red for visibility
      emissive: 0x330000, // Slight emissiveness
    });
    const character = new THREE.Mesh(characterGeometry, characterMaterial);
    character.position.set(0, 5, 150); // Start in front of initial camera position, on the valley floor
    scene.add(character);

    // Grid Helper
    const gridSize = 4000; // Match the plane size
    const gridDivisions = 100; // Increased divisions for density over larger area
    const gridColorCenterLine = 0x444444; // Tron-like blue or cyan could be good too
    const gridColorGrid = 0x222222; // Darker lines
    const gridHelper = new THREE.GridHelper(
      gridSize,
      gridDivisions,
      new THREE.Color(gridColorCenterLine),
      new THREE.Color(gridColorGrid)
    );
    gridHelper.position.y = 0.1; // Slightly above the plane to avoid z-fighting
    scene.add(gridHelper);

    // Optional: Add some fog for depth
    // Adjusted fog for a longer draw distance, starting sooner and becoming dense further out.
    scene.fog = new THREE.Fog(0x000000, 100, 1200); // color, near distance from camera, far distance from camera

    // --- Animation Loop ---
    const animate = () => {
      requestAnimationFrame(animate);
      timeRef.current += 0.01;

      // Character movement down the valley
      const characterSpeed = 0.5;
      character.position.z -= characterSpeed;

      // Camera follows character
      const cameraOffset = new THREE.Vector3(0, 15, 30); // Behind and slightly above the character
      camera.position.copy(character.position).add(cameraOffset);
      camera.lookAt(character.position); // Always look at the character

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
      if (containerRef.current) {
        // Check if renderer.domElement is a child before removing
        if (renderer.domElement.parentNode === containerRef.current) {
          containerRef.current.removeChild(renderer.domElement);
        }
      }
      // Dispose geometries and materials if they are not reused
      planeGeometry.dispose();
      planeMaterial.dispose();
      gridHelper.geometry.dispose();
      (gridHelper.material as THREE.Material).dispose();
    };
  }, []);

  return <div ref={containerRef} className="fixed inset-0 -z-10 " />;
}
