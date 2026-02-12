import { useEffect, useRef } from "react";
import * as THREE from "three";

export function TopographicBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // --- Scene Setup ---
    const scene = new THREE.Scene();
    // Use a medium gray background for contrast with the white contour lines.
    scene.background = new THREE.Color(0x2e2e2e);

    // --- Camera Setup ---
    const camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    // Adjusted camera position for a more dynamic view.
    camera.position.set(0, 80, 150);
    camera.lookAt(0, 0, 0);

    // --- Renderer Setup ---
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // --- Create a Denser Plane with Wireframe ---
    // This plane has 100 subdivisions on each side to better reveal contour lines.
    const geometry = new THREE.PlaneGeometry(100, 100, 100, 100);
    // Use MeshBasicMaterial so that lighting won't affect brightness.
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      wireframe: true,
      transparent: true,
      opacity: 0.85,
    });
    const plane = new THREE.Mesh(geometry, material);
    // Rotate the plane so it lies horizontally.
    plane.rotation.x = -Math.PI / 2;
    scene.add(plane);

    // --- Animation Loop ---
    const animate = () => {
      requestAnimationFrame(animate);

      // Increase time to animate the waves.
      timeRef.current += 0.01;

      // Update the plane's vertices for a dynamic topographic effect.
      const positionAttribute = geometry.attributes.position;
      for (let i = 0; i < positionAttribute.count; i++) {
        const x = positionAttribute.getX(i); // Range approximately [-50, 50]
        const z = positionAttribute.getZ(i); // Range approximately [-50, 50]
        const frequency = 0.15; // Increased frequency for more detail
        const amplitude = 20; // Increased amplitude for more pronounced contours
        // Shift coordinates from [-50,50] to [0,100] for a more natural frequency distribution.
        const rawY =
          Math.sin((x + 50) * frequency + timeRef.current) * amplitude +
          Math.cos((z + 50) * frequency + timeRef.current) * amplitude;
        const quantizeStep = 2; // Adjust step size for distinct contour levels
        const y = Math.round(rawY / quantizeStep) * quantizeStep;
        positionAttribute.setY(i, y);
      }
      positionAttribute.needsUpdate = true;
      geometry.computeVertexNormals();

      // Slowly orbit the camera around the center for a dynamic view of the topography.
      const radius = 150; // Increased orbit radius for a wider view
      const speed = 0.1; // Adjusted orbit speed
      camera.position.x = Math.sin(timeRef.current * speed) * radius;
      camera.position.z = Math.cos(timeRef.current * speed) * radius;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    };

    animate();

    // --- Handle Window Resize ---
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", handleResize);

    // --- Cleanup ---
    return () => {
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      geometry.dispose();
      material.dispose();
    };
  }, []);

  return <div ref={containerRef} className="fixed inset-0 -z-10" />;
}
