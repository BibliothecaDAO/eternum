import { useEffect, useRef } from "react";
import * as THREE from "three";

interface HexGridBackgroundProps {
  colorPrimary?: string;
  colorSecondary?: string;
  colorGlow?: string;
  density?: "low" | "medium" | "high";
  opacity?: number;
  disableHover?: boolean;
  className?: string;
}

/* ── Hex grid helpers ── */

function createHexShape(radius: number): THREE.Shape {
  const shape = new THREE.Shape();
  for (let i = 0; i < 6; i++) {
    // Pointy-top hexagon: first vertex at 30°, counterclockwise
    // Width = sqrt(3)*r, Height = 2*r — matches the grid spacing below
    const angle = (Math.PI / 3) * i + Math.PI / 6;
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);
    if (i === 0) {
      shape.moveTo(x, y);
    } else {
      shape.lineTo(x, y);
    }
  }
  shape.closePath();
  return shape;
}

function getHexPositions(
  count: number
): { x: number; z: number; col: number; row: number }[] {
  const positions: { x: number; z: number; col: number; row: number }[] = [];
  // Compute grid dimensions to fill roughly `count` hexes in a square-ish layout
  const cols = Math.ceil(Math.sqrt(count * 1.5));
  const rows = Math.ceil(count / cols);

  const hexW = Math.sqrt(3); // pointy-top hex: width = sqrt(3) * radius
  const hexH = 2.0; // pointy-top hex: height = 2 * radius
  const rowSpacing = hexH * 0.75; // vertical distance between row centers (3/4 height)
  const gap = 0.12;

  const totalW = cols * (hexW + gap);
  const totalH = rows * (rowSpacing + gap);

  let placed = 0;
  for (let row = 0; row < rows && placed < count; row++) {
    for (let col = 0; col < cols && placed < count; col++) {
      const xOffset = row % 2 === 1 ? (hexW + gap) * 0.5 : 0;
      const x = col * (hexW + gap) + xOffset - totalW * 0.5;
      const z = row * (rowSpacing + gap) - totalH * 0.5;
      positions.push({ x, z, col, row });
      placed++;
    }
  }
  return positions;
}

export function HexGridBackground({
  colorPrimary = "#4ecdc4",
  colorSecondary = "#2a6f97",
  colorGlow = "#00ffcc",
  density = "medium",
  opacity = 0.6,
  disableHover = false,
  className,
}: HexGridBackgroundProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    /* ── Environment detection ── */
    const isSmall = window.innerWidth < 768;
    const motionScale = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches
      ? 0.15
      : 1;

    const densityMap = { low: 100, medium: 300, high: 500 };
    const effectiveDensity = isSmall ? "low" : density;
    const hexCount = densityMap[effectiveDensity];

    const W = window.innerWidth;
    const H = window.innerHeight;

    /* ── Renderer ── */
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSmall,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(W, H);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    /* ── Scene ── */
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.06);

    /* ── Camera: looking down at ~35 degrees ── */
    const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 200);
    camera.position.set(0, 12, 14);
    camera.lookAt(0, 0, 0);

    /* ── Colors ── */
    const cPrimary = new THREE.Color(colorPrimary);
    const cSecondary = new THREE.Color(colorSecondary);
    const cGlow = new THREE.Color(colorGlow);

    /* ── Hex geometry ── */
    const hexRadius = 1.0;
    const hexShape = createHexShape(hexRadius);
    const hexPositions = getHexPositions(hexCount);

    // Face geometry: extruded very thin to create a flat panel
    const faceGeometry = new THREE.ShapeGeometry(hexShape);
    // Rotate so hex lies flat on XZ plane (Shape creates on XY, we need XZ)
    faceGeometry.rotateX(-Math.PI / 2);

    // Edge geometry from the face
    const edgeGeometry = new THREE.EdgesGeometry(faceGeometry);

    /* ── Instance positions as attribute ── */
    const instanceCenters = new Float32Array(hexCount * 3);
    const faceMatrices: THREE.Matrix4[] = [];

    for (let i = 0; i < hexPositions.length; i++) {
      const pos = hexPositions[i];
      instanceCenters[i * 3] = pos.x;
      instanceCenters[i * 3 + 1] = 0;
      instanceCenters[i * 3 + 2] = pos.z;

      const m = new THREE.Matrix4();
      m.setPosition(pos.x, 0, pos.z);
      faceMatrices.push(m);
    }

    /* ── Face InstancedMesh with custom ShaderMaterial ── */
    const faceShaderMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.NormalBlending,
      uniforms: {
        mouseWorld: { value: new THREE.Vector3(0, 0, 1000) },
        uColorBase: { value: new THREE.Vector3(cSecondary.r, cSecondary.g, cSecondary.b) },
        uColorGlow: { value: new THREE.Vector3(cGlow.r, cGlow.g, cGlow.b) },
        uTime: { value: 0 },
        uGlowRadius: { value: 3.5 },
      },
      vertexShader: /* glsl */ `
        attribute vec3 instanceCenter;
        varying vec3 vInstanceCenter;
        varying vec3 vWorldPos;

        void main() {
          // instanceMatrix is provided by InstancedMesh
          vec4 worldPos = instanceMatrix * vec4(position, 1.0);
          vWorldPos = worldPos.xyz;
          vInstanceCenter = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 mouseWorld;
        uniform vec3 uColorBase;
        uniform vec3 uColorGlow;
        uniform float uTime;
        uniform float uGlowRadius;

        varying vec3 vInstanceCenter;
        varying vec3 vWorldPos;

        void main() {
          // Distance from hex center to mouse on XZ plane
          float dx = vInstanceCenter.x - mouseWorld.x;
          float dz = vInstanceCenter.z - mouseWorld.z;
          float dist = sqrt(dx * dx + dz * dz);

          // Mouse proximity glow
          float glow = 1.0 - smoothstep(0.0, uGlowRadius, dist);
          glow = glow * glow; // Quadratic falloff for smoother look

          // Base color: very dark, subtle secondary tint
          vec3 baseColor = uColorBase * 0.08;

          // Glow color near mouse
          vec3 glowColor = uColorGlow * glow * 0.35;

          vec3 finalColor = baseColor + glowColor;
          float finalAlpha = 0.12 + glow * 0.25;

          gl_FragColor = vec4(finalColor, finalAlpha);
        }
      `,
    });

    const faceMesh = new THREE.InstancedMesh(
      faceGeometry,
      faceShaderMaterial,
      hexCount
    );

    // Set instance matrices
    for (let i = 0; i < hexCount; i++) {
      faceMesh.setMatrixAt(i, faceMatrices[i]);
    }
    faceMesh.instanceMatrix.needsUpdate = true;

    // Add instanceCenter attribute
    const faceCenterAttr = new THREE.InstancedBufferAttribute(
      instanceCenters,
      3
    );
    faceMesh.geometry.setAttribute("instanceCenter", faceCenterAttr);

    scene.add(faceMesh);

    /* ── Edge InstancedMesh with custom ShaderMaterial ── */
    // For edges we use InstancedMesh with LineSegments-like approach
    // THREE.InstancedMesh requires a Mesh, so we create a thin tube-like edge
    // Alternative: use InstancedBufferGeometry with LineSegments
    // However, InstancedMesh doesn't work with LineSegments, so we use a custom approach

    // Build edge geometry as thin triangles (ribbon) from the hex outline
    const edgePositions = edgeGeometry.attributes.position;
    const edgeVertCount = edgePositions.count;
    const ribbonPositions: number[] = [];
    const ribbonIndices: number[] = [];
    const ribbonWidth = 0.03;

    // EdgesGeometry gives pairs of vertices (line segments)
    for (let i = 0; i < edgeVertCount; i += 2) {
      const ax = edgePositions.getX(i);
      const ay = edgePositions.getY(i);
      const az = edgePositions.getZ(i);
      const bx = edgePositions.getX(i + 1);
      const by = edgePositions.getY(i + 1);
      const bz = edgePositions.getZ(i + 1);

      // Direction along the edge
      const dx = bx - ax;
      const dz = bz - az;
      const len = Math.sqrt(dx * dx + dz * dz);
      if (len === 0) continue;

      // Normal perpendicular to edge on XZ plane, pointing up-ish
      const nx = -dz / len * ribbonWidth;
      const nz = dx / len * ribbonWidth;

      const baseIdx = ribbonPositions.length / 3;

      // Quad: 4 vertices per edge segment
      ribbonPositions.push(ax + nx, ay + ribbonWidth, az + nz);
      ribbonPositions.push(ax - nx, ay - ribbonWidth, az - nz);
      ribbonPositions.push(bx + nx, by + ribbonWidth, bz + nz);
      ribbonPositions.push(bx - nx, by - ribbonWidth, bz - nz);

      ribbonIndices.push(baseIdx, baseIdx + 1, baseIdx + 2);
      ribbonIndices.push(baseIdx + 1, baseIdx + 3, baseIdx + 2);
    }

    const edgeRibbonGeo = new THREE.BufferGeometry();
    edgeRibbonGeo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(ribbonPositions, 3)
    );
    edgeRibbonGeo.setIndex(ribbonIndices);

    const edgeShaderMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: {
        mouseWorld: { value: new THREE.Vector3(0, 0, 1000) },
        uColorPrimary: { value: new THREE.Vector3(cPrimary.r, cPrimary.g, cPrimary.b) },
        uColorGlow: { value: new THREE.Vector3(cGlow.r, cGlow.g, cGlow.b) },
        uTime: { value: 0 },
        uGlowRadius: { value: 3.5 },
        uMotionScale: { value: motionScale },
      },
      vertexShader: /* glsl */ `
        attribute vec3 instanceCenter;
        varying vec3 vInstanceCenter;
        varying vec3 vWorldPos;

        void main() {
          vec4 worldPos = instanceMatrix * vec4(position, 1.0);
          vWorldPos = worldPos.xyz;
          vInstanceCenter = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 mouseWorld;
        uniform vec3 uColorPrimary;
        uniform vec3 uColorGlow;
        uniform float uTime;
        uniform float uGlowRadius;
        uniform float uMotionScale;

        varying vec3 vInstanceCenter;
        varying vec3 vWorldPos;

        void main() {
          // Distance from hex center to mouse on XZ plane
          float dx = vInstanceCenter.x - mouseWorld.x;
          float dz = vInstanceCenter.z - mouseWorld.z;
          float dist = sqrt(dx * dx + dz * dz);

          // Mouse proximity glow
          float mouseGlow = 1.0 - smoothstep(0.0, uGlowRadius, dist);
          mouseGlow = mouseGlow * mouseGlow;

          // Wave pulse from center
          float distFromCenter = length(vInstanceCenter.xz);
          float waveSpeed = 3.0 * uMotionScale;
          float waveFreq = 0.8;
          float wave1 = sin(distFromCenter * waveFreq - uTime * waveSpeed) * 0.5 + 0.5;
          float wave2 = sin(distFromCenter * waveFreq * 0.7 - uTime * waveSpeed * 0.6 + 2.0) * 0.5 + 0.5;
          float wavePulse = max(wave1, wave2) * 0.3;

          // Gentle breathe oscillation
          float breathe = sin(uTime * 1.5 * uMotionScale + distFromCenter * 0.3) * 0.5 + 0.5;
          float breatheAmount = breathe * 0.15;

          // Base edge color: primary at low opacity
          float baseIntensity = 0.3 + breatheAmount + wavePulse;

          // Combine base and mouse glow
          vec3 edgeColor = mix(uColorPrimary, uColorGlow, mouseGlow * 0.8 + wavePulse * 0.3);
          float edgeAlpha = baseIntensity + mouseGlow * 0.6;

          edgeAlpha = clamp(edgeAlpha, 0.0, 1.0);

          gl_FragColor = vec4(edgeColor * edgeAlpha, edgeAlpha * 0.8);
        }
      `,
    });

    const edgeMesh = new THREE.InstancedMesh(
      edgeRibbonGeo,
      edgeShaderMaterial,
      hexCount
    );

    // Set same instance matrices as faces
    for (let i = 0; i < hexCount; i++) {
      edgeMesh.setMatrixAt(i, faceMatrices[i]);
    }
    edgeMesh.instanceMatrix.needsUpdate = true;

    // Add instanceCenter attribute to edge mesh
    const edgeCenterAttr = new THREE.InstancedBufferAttribute(
      new Float32Array(instanceCenters),
      3
    );
    edgeMesh.geometry.setAttribute("instanceCenter", edgeCenterAttr);

    scene.add(edgeMesh);

    /* ── Raycaster for mouse interaction ── */
    const raycaster = new THREE.Raycaster();
    const pointerNDC = new THREE.Vector2(0, 0);
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const mouseWorldPos = new THREE.Vector3(0, 0, 1000);
    let mouseActive = false;

    const onPointerMove = (e: PointerEvent) => {
      pointerNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointerNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;
      mouseActive = true;
    };

    const onPointerLeave = () => {
      mouseActive = false;
      mouseWorldPos.set(0, 0, 1000); // Move mouse influence far away
    };

    /* ── Camera base position for parallax ── */
    const cameraBasePos = new THREE.Vector3(0, 12, 14);

    /* ── Animation loop ── */
    let rafId = 0;
    const clock = new THREE.Clock();

    const animate = () => {
      rafId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      // Update time uniforms
      faceShaderMaterial.uniforms.uTime.value = t;
      edgeShaderMaterial.uniforms.uTime.value = t;

      // Raycast mouse onto ground plane
      if (mouseActive) {
        raycaster.setFromCamera(pointerNDC, camera);
        const intersection = new THREE.Vector3();
        const hit = raycaster.ray.intersectPlane(groundPlane, intersection);
        if (hit) {
          mouseWorldPos.copy(intersection);
        }
      }

      faceShaderMaterial.uniforms.mouseWorld.value.copy(mouseWorldPos);
      edgeShaderMaterial.uniforms.mouseWorld.value.copy(mouseWorldPos);

      // Camera parallax: subtle shift based on pointer
      const parallaxStrength = 0.8 * motionScale;
      const targetX =
        cameraBasePos.x + pointerNDC.x * parallaxStrength;
      const targetY =
        cameraBasePos.y + pointerNDC.y * parallaxStrength * 0.3;
      camera.position.x += (targetX - camera.position.x) * 0.03;
      camera.position.y += (targetY - camera.position.y) * 0.03;
      camera.position.z = cameraBasePos.z;
      camera.lookAt(0, 0, 0);

      // Render
      renderer.render(scene, camera);
    };

    animate();

    /* ── Resize handler ── */
    const onResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    };

    /* ── Event listeners ── */
    window.addEventListener("resize", onResize);
    if (!disableHover) {
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerleave", onPointerLeave);
    }

    /* ── Cleanup ── */
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", onResize);
      if (!disableHover) {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerleave", onPointerLeave);
      }

      faceGeometry.dispose();
      faceShaderMaterial.dispose();
      edgeGeometry.dispose();
      edgeRibbonGeo.dispose();
      edgeShaderMaterial.dispose();

      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [colorPrimary, colorSecondary, colorGlow, density, opacity, disableHover]);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={`absolute inset-0 pointer-events-none ${className ?? ""}`}
      style={{ opacity }}
    />
  );
}
