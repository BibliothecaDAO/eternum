import { useEffect, useRef } from "react";
import * as THREE from "three";
import chroma from "chroma-js";
// If you want orbit controls for easy debugging:
// import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export function HeightmapTerrain() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // --- Scene Setup ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xfafafa);

    // --- Camera Setup ---
    const camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      10000
    );
    camera.position.set(1200, 500, 1200);
    camera.lookAt(new THREE.Vector3(0, 0, 0));

    // --- Renderer Setup ---
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    containerRef.current.appendChild(renderer.domElement);

    // --- Lights ---
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(1000, 1000, 1000);
    scene.add(directionalLight);

    // Add a small ambient light so the terrain isn’t completely reliant on directional
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);

    // (Optional) Add orbit controls to help see what’s going on:
    /*
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0);
    controls.update();
    */

    // --- Terrain Geometry Parameters ---
    const resolution = 128; // Lower or raise based on performance
    const spacingX = 3;
    const spacingZ = 3;
    const heightOffset = 2; // dividing grayscale 0–255 => 0–127.5
    const canvas = document.createElement("canvas");
    canvas.width = resolution;
    canvas.height = resolution;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Load the heightmap image
    const img = new Image();
    // Make sure the path is correct and the file is accessible:
    img.src = "/grandcanyon.png";
    img.crossOrigin = "Anonymous";

    img.onload = () => {
      // Draw the heightmap to our offscreen canvas
      ctx.drawImage(img, 0, 0, resolution, resolution);
      const pixelData = ctx.getImageData(0, 0, resolution, resolution);

      // --- Build Geometry from Heightmap ---
      const numVertices = resolution * resolution;
      const positions = new Float32Array(numVertices * 3);
      const colors = new Float32Array(numVertices * 3);

      // Adjust domain to match your actual height range (0..127ish)
      const colorScale = chroma
        .scale(["blue", "green", "red"])
        .domain([0, 128]);

      let vertexIndex = 0;
      for (let z = 0; z < resolution; z++) {
        for (let x = 0; x < resolution; x++) {
          const pixelIndex = (z * resolution + x) * 4;
          // Using the red channel (assuming the image is grayscale)
          const heightValue = pixelData.data[pixelIndex] / heightOffset;

          positions[vertexIndex] = x * spacingX; // X position
          positions[vertexIndex + 1] = heightValue; // Y (elevation)
          positions[vertexIndex + 2] = z * spacingZ; // Z position

          // Color by height
          const hexColor = colorScale(heightValue).hex();
          const color = new THREE.Color(hexColor);
          colors[vertexIndex] = color.r;
          colors[vertexIndex + 1] = color.g;
          colors[vertexIndex + 2] = color.b;

          vertexIndex += 3;
        }
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(positions, 3)
      );
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

      // Build indices for the grid
      const indices = [];
      for (let z = 0; z < resolution - 1; z++) {
        for (let x = 0; x < resolution - 1; x++) {
          const a = x + z * resolution;
          const b = x + 1 + z * resolution;
          const c = x + (z + 1) * resolution;
          const d = x + 1 + (z + 1) * resolution;

          // Two triangles per quad
          indices.push(a, b, d);
          indices.push(d, c, a);
        }
      }
      geometry.setIndex(indices);
      geometry.computeVertexNormals();

      // Center the geometry horizontally
      geometry.computeBoundingBox();
      if (geometry.boundingBox) {
        const bbox = geometry.boundingBox;
        const centerX = (bbox.max.x + bbox.min.x) / 2;
        const centerZ = (bbox.max.z + bbox.min.z) / 2;
        geometry.translate(-centerX, 0, -centerZ);
      }

      // --- Create Mesh ---
      const material = new THREE.MeshLambertMaterial({
        vertexColors: true,
        flatShading: true,
      });
      // For debugging, you could do: material.wireframe = true;

      const mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);
    };

    // --- Animation Loop ---
    const animate = () => {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    // --- Handle Resize ---
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", handleResize);

    // Cleanup
    return () => {
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
    };
  }, []);

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}
