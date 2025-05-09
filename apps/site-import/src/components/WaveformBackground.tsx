import { useEffect, useRef } from "react";
import * as THREE from "three";

export function WaveformBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef(0);
  const lineMeshesRef = useRef<THREE.Line[]>([]);

  useEffect(() => {
    if (!containerRef.current) return;

    // --- Scene Setup ---
    const scene = new THREE.Scene();
    // A dark background to make colorful waveforms pop.
    scene.background = new THREE.Color(0x000000);

    // --- Camera Setup ---
    const camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      1,
      1000
    );
    camera.position.set(0, 100, 300);
    camera.lookAt(0, 0, 0);

    // --- Renderer Setup ---
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);

    // --- Create Waveform Lines ---
    // We'll create several horizontal lines that animate as sine waves.
    const numLines = 10;
    const waveLength = 400; // Total x-span in scene units.
    const numPoints = 200; // Number of segments per line.
    const linesGroup = new THREE.Group();
    scene.add(linesGroup);

    for (let i = 0; i < numLines; i++) {
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(numPoints * 3);
      // For each point on the line, x ranges from -waveLength/2 to +waveLength/2.
      // Initial y = 0, and z is set based on the line's index to vertically separate the strokes.
      for (let j = 0; j < numPoints; j++) {
        const x = (j / (numPoints - 1)) * waveLength - waveLength / 2;
        positions[j * 3] = x;
        positions[j * 3 + 1] = 0; // y will be animated.
        // Spread lines vertically (using z-axis) with a 50-unit separation.
        const z = (i - (numLines - 1) / 2) * 50;
        positions[j * 3 + 2] = z;
      }
      geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(positions, 3)
      );

      // Set a distinct color for each line by varying the hue.
      const hue = (i / numLines) * 360;
      const material = new THREE.LineBasicMaterial({
        color: new THREE.Color(`hsl(${hue}, 100%, 50%)`),
      });
      const line = new THREE.Line(geometry, material);
      linesGroup.add(line);
      lineMeshesRef.current.push(line);
    }

    // --- Animation Loop ---
    const animate = () => {
      requestAnimationFrame(animate);
      timeRef.current += 0.02; // Controls the speed of the animation

      // Pulsing setup: modulate amplitude over time.
      const baseAmplitude = 20; // Maximum displacement for the sine wave.
      const pulseFactor = 1 + 0.3 * Math.sin(timeRef.current * 2); // Pulsing effect
      const amplitude = baseAmplitude * pulseFactor;

      // Noise setup: additional variation for a more organic wave.
      const noiseAmplitude = 5; // Adjust this value to control noise strength.
      const noiseFrequency = 0.1; // Controls frequency of the additional noise

      // Update each waveform line.
      for (const line of lineMeshesRef.current) {
        const geometry = line.geometry as THREE.BufferGeometry;
        const positions = geometry.attributes.position.array as Float32Array;
        const numPts = geometry.attributes.position.count;
        // Use the line's index within the group as a phase offset.
        const lineIndex = linesGroup.children.indexOf(line);
        const phaseOffset = lineIndex * 0.5;
        for (let j = 0; j < numPts; j++) {
          const x = positions[j * 3]; // x remains static.
          const frequency = 0.02; // Frequency of the base sine wave.

          // Base sine wave with pulsing amplitude.
          const waveY =
            amplitude * Math.sin(frequency * x + timeRef.current + phaseOffset);
          // Extra noise component for organic variation.
          const noiseY =
            noiseAmplitude *
            Math.sin(noiseFrequency * x + timeRef.current * 3 + phaseOffset);

          // Combine wave and noise, then quantize to create a blocky effect.
          const combinedY = waveY + noiseY;
          const blockSize = 10; // Adjust for desired block granularity.
          positions[j * 3 + 1] = Math.round(combinedY / blockSize) * blockSize;
        }
        geometry.attributes.position.needsUpdate = true;

        // Generative dynamic color shift: update line material color over time.
        const hueShiftSpeed = 15; // degrees per second, adjust as desired.
        const hueIncrement = (timeRef.current * hueShiftSpeed) % 360;
        const baseHue = (lineIndex / numLines) * 360;
        const newHue = (baseHue + hueIncrement) % 360;
        (line.material as THREE.LineBasicMaterial).color.set(
          new THREE.Color(`hsl(${newHue}, 100%, 50%)`)
        );
      }

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
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={containerRef} className="fixed inset-0 -z-10 " />;
}
