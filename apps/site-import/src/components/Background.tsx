import { useEffect, useRef } from "react";
import * as THREE from "three";

interface TracingLine {
  line: THREE.Line;
  currentPoint: THREE.Vector3;
  targetPoint: THREE.Vector3;
  points: THREE.Vector3[];
  maxPoints: number;
}

const TRACE_COLORS = [
  0x00ff88, // cyan
  0xff1f1f, // red
  0x00ffff, // bright cyan
  0xff00ff, // magenta
  0xffff00, // yellow
  0x4444ff, // blue
  0xff8800, // orange
];

export function Background() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const targetRotationRef = useRef({ x: 0, y: 0 });
  const currentRotationRef = useRef({ x: 0, y: 0 });
  const tracingLinesRef = useRef<TracingLine[]>([]);

  useEffect(() => {
    if (!containerRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    sceneRef.current = scene;

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.set(0, 10, 20);
    camera.lookAt(0, 0, -50);
    cameraRef.current = camera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Main grid
    const mainGrid = new THREE.GridHelper(200, 50, 0x222222, 0x222222);
    mainGrid.position.z = -100;
    scene.add(mainGrid);

    // Secondary grid (smaller divisions)
    const secondaryGrid = new THREE.GridHelper(200, 100, 0x111111, 0x111111);
    secondaryGrid.position.z = -100;
    scene.add(secondaryGrid);

    // Add vertical lines for depth
    const verticalLinesGeometry = new THREE.BufferGeometry();
    const verticalLinesCount = 20;
    const verticalLinesPositions = [];
    const verticalLinesSpacing = 20;

    for (let i = -verticalLinesCount / 2; i < verticalLinesCount / 2; i++) {
      verticalLinesPositions.push(
        i * verticalLinesSpacing,
        -10,
        -200,
        i * verticalLinesSpacing,
        10,
        -200
      );
    }

    verticalLinesGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(verticalLinesPositions, 3)
    );

    const verticalLinesMaterial = new THREE.LineBasicMaterial({
      color: 0x333333,
      transparent: true,
      opacity: 0.5,
    });

    const verticalLines = new THREE.LineSegments(
      verticalLinesGeometry,
      verticalLinesMaterial
    );
    scene.add(verticalLines);

    // Add fog for depth
    scene.fog = new THREE.Fog(0x000000, 50, 150);

    // Mouse movement handler
    const handleMouseMove = (event: MouseEvent) => {
      mouseRef.current.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouseRef.current.y = -(event.clientY / window.innerHeight) * 2 + 1;

      // Set target rotation based on mouse position with reduced sensitivity
      targetRotationRef.current.x = mouseRef.current.y * 0.05; // reduced from 0.1
      targetRotationRef.current.y = mouseRef.current.x * 0.05; // reduced from 0.1
    };

    window.addEventListener("mousemove", handleMouseMove);

    // Animation
    let offset = 0;
    const speed = 0.5;

    // Create tracing lines
    const createTracingLine = (colorIndex: number) => {
      const material = new THREE.LineBasicMaterial({
        color: TRACE_COLORS[colorIndex % TRACE_COLORS.length],
        transparent: true,
        opacity: 0.6,
        linewidth: 2,
      });

      const geometry = new THREE.BufferGeometry();
      const line = new THREE.Line(geometry, material);
      scene.add(line);

      // Start at a random grid intersection
      const gridSize = 20;
      const gridDivisions = 10;
      const startX =
        Math.floor(Math.random() * gridDivisions - gridDivisions / 2) *
        gridSize;
      const startZ = -100;

      return {
        line,
        currentPoint: new THREE.Vector3(startX, 0, startZ),
        targetPoint: new THREE.Vector3(startX, 0, startZ),
        points: [new THREE.Vector3(startX, 0, startZ)],
        maxPoints: 50,
      };
    };

    // Create multiple tracing lines with different colors
    const numLines = 7; // One for each color
    for (let i = 0; i < numLines; i++) {
      tracingLinesRef.current.push(createTracingLine(i));
    }

    // Function to get new target point that aligns with grid
    const getNewTargetPoint = (currentPoint: THREE.Vector3) => {
      const gridSize = 20; // Must match the size between grid lines
      const direction = Math.floor(Math.random() * 4); // 0: forward, 1: right, 2: left
      const newPoint = currentPoint.clone();

      switch (direction) {
        case 0: // forward
          newPoint.z += gridSize;
          break;
        case 1: // right
          newPoint.x += gridSize;
          break;
        case 2: // left
          newPoint.x -= gridSize;
          break;
      }

      // Keep within bounds and snap to grid
      newPoint.x = Math.round(newPoint.x / gridSize) * gridSize;
      newPoint.x = Math.max(-100, Math.min(100, newPoint.x));
      return newPoint;
    };

    // Update tracing lines in animation
    const updateTracingLines = () => {
      tracingLinesRef.current.forEach((tracingLine) => {
        const { line, currentPoint, targetPoint, points } = tracingLine;

        // Move current point towards target in a straight line
        const moveSpeed = 0.8;
        currentPoint.lerp(targetPoint, moveSpeed);

        // If close to target, set new target at next grid intersection
        if (currentPoint.distanceTo(targetPoint) < 0.1) {
          tracingLine.targetPoint = getNewTargetPoint(currentPoint);
        }

        // Add point to line
        points.push(currentPoint.clone());

        // Remove old points if too many
        if (points.length > tracingLine.maxPoints) {
          points.shift();
        }

        // Update line geometry
        const positions = new Float32Array(points.length * 3);
        points.forEach((point, i) => {
          positions[i * 3] = point.x;
          positions[i * 3 + 1] = point.y;
          positions[i * 3 + 2] = point.z;
        });

        line.geometry.setAttribute(
          "position",
          new THREE.BufferAttribute(positions, 3)
        );

        // Reset line if it's gone too far forward
        if (currentPoint.z > 20) {
          const gridSize = 20;
          const gridDivisions = 10;
          const startX =
            Math.floor(Math.random() * gridDivisions - gridDivisions / 2) *
            gridSize;
          const startZ = -100;
          currentPoint.set(startX, 0, startZ);
          targetPoint.set(startX, 0, startZ);
          points.length = 0;
          points.push(currentPoint.clone());
        }

        // Move all points forward
        points.forEach((point) => {
          point.z += speed;
        });
      });
    };

    const animate = () => {
      requestAnimationFrame(animate);

      // Slower interpolation for smoother camera movement
      const rotationLerpFactor = 0.02; // reduced from 0.05

      // Smoothly interpolate current rotation towards target rotation
      currentRotationRef.current.x +=
        (targetRotationRef.current.x - currentRotationRef.current.x) *
        rotationLerpFactor;
      currentRotationRef.current.y +=
        (targetRotationRef.current.y - currentRotationRef.current.y) *
        rotationLerpFactor;

      // Reduced camera movement range
      camera.position.x = Math.sin(currentRotationRef.current.y) * 15; // reduced from 20
      camera.position.y = 10 + currentRotationRef.current.x * 5; // reduced from 10
      camera.lookAt(0, 0, -50);

      // Move grids forward
      offset += speed;
      mainGrid.position.z += speed;
      secondaryGrid.position.z += speed;
      verticalLines.position.z += speed;

      // Reset positions when they get too close
      if (mainGrid.position.z > 20) {
        mainGrid.position.z = -100;
        secondaryGrid.position.z = -100;
        verticalLines.position.z = 0;
      }

      // Update tracing lines
      updateTracingLines();

      renderer.render(scene, camera);
    };

    animate();

    // Handle resize
    const handleResize = () => {
      if (!renderer || !camera) return;

      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
      containerRef.current?.removeChild(renderer.domElement);
      tracingLinesRef.current.forEach((tracingLine) => {
        scene.remove(tracingLine.line);
        tracingLine.line.geometry.dispose();
        (tracingLine.line.material as THREE.Material).dispose();
      });
    };
  }, []);

  return <div ref={containerRef} className="fixed inset-0 -z-10" />;
}
